// ============================================================================
// معالج الرسائل — الحفظ والبثّ
//
// استراتيجية الأداء:
// 1. نبثّ الرسالة للغرفة فوراً (optimistic broadcast)
// 2. نحفظها في DB بشكل غير متزامن (async persist)
// 3. نُبلِّغ المُرسِل بنجاح الحفظ أو فشله
//
// هذا يضمن تجربة مستخدم سريعة مع ضمان استمرارية البيانات
// ============================================================================

import { randomUUID } from "crypto";
import type { TypedSocket, TypedServer, SendMessagePayload } from "../types/socket.types";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { FileType } from "@prisma/client";

// تحديد المعدّل: Map بسيطة في الذاكرة (في production: استخدمي Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000; // دقيقة واحدة
const RATE_LIMIT_MAX_MESSAGES = 60;  // 60 رسالة في الدقيقة

export function registerMessageHandlers(
  socket: TypedSocket,
  io: TypedServer
): void {
  const user = socket.data.user;

  socket.on("send_message", async (payload: SendMessagePayload, callback) => {
    const {
      roomId,
      content,
      tempId,
      fileUrl,
      fileType,
    } = payload;

    // ── التحقّق من الحقول الإلزامية ────────────────────────────────────────
    if (!roomId || typeof roomId !== "string") {
      return callback({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "roomId is required." },
      });
    }

    if (!tempId || typeof tempId !== "string") {
      return callback({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "tempId is required for message tracking." },
      });
    }

    const trimmedContent = (content ?? "").trim();

    if (!trimmedContent && !fileUrl) {
      return callback({
        success: false,
        error: { code: "EMPTY_MESSAGE", message: "Message must have content or an attachment." },
      });
    }

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return callback({
        success: false,
        error: {
          code: "MESSAGE_TOO_LONG",
          message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
        },
      });
    }

    // ── التحقّق أن المُرسِل في الغرفة المستهدَفة ──────────────────────────────
    if (!socket.rooms.has(roomId)) {
      logger.warn("Message rejected: sender not in room", {
        userId: user.id,
        roomId,
        socketId: socket.id,
      });
      return callback({
        success: false,
        error: {
          code: "NOT_IN_ROOM",
          message: "You must join the room before sending messages.",
        },
      });
    }

    // ── تحديد معدّل الرسائل ────────────────────────────────────────────────
    const rateLimitResult = checkRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return callback({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many messages. Please wait ${rateLimitResult.retryAfterSeconds} seconds.`,
        },
      });
    }

    // ── تحليل الغرفة لتحديد حقول DB ─────────────────────────────────────────
    const roomContext = parseRoomContext(roomId, user.id);
    if (!roomContext) {
      return callback({
        success: false,
        error: { code: "INVALID_ROOM_ID", message: "Cannot parse room identifier." },
      });
    }

    // ── توليد معرّف الرسالة على الخادم ────────────────────────────────────────
    const messageId = randomUUID();
    const createdAt = new Date();

    // ── البثّ الفوري (Optimistic) ───────────────────────────────────────────
    // نُرسِل قبل الحفظ لضمان تجربة سريعة
    const broadcastPayload = {
      id: messageId,
      tempId,
      content: trimmedContent,
      fileUrl: fileUrl ?? null,
      fileType: (fileType ?? null) as string | null,
      senderId: user.id,
      senderName: user.name,
      senderImage: user.image,
      senderRole: user.role,
      roomId,
      courseId: roomContext.courseId,
      projectId: roomContext.projectId,
      isSupport: roomContext.isSupport,
      isSystem: false,
      createdAt: createdAt.toISOString(),
    };

    // البثّ للجميع في الغرفة (بما فيهم المُرسِل عبر io.to لا socket.to)
    io.to(roomId).emit("new_message", broadcastPayload);

    // ── إشعار المُرسِل بأن الرسالة أُرسِلت (قبل الحفظ) ──────────────────────
    callback({
      success: true,
      data: {
        messageId,
        tempId,
        createdAt: createdAt.toISOString(),
      },
    });

    // ── الحفظ غير المتزامن في قاعدة البيانات ─────────────────────────────────
    // نُنفِّذ هذا بعد إرسال الـ callback لعدم إبطاء الاستجابة
    persistMessageToDatabase({
      messageId,
      content: trimmedContent,
      fileUrl: fileUrl ?? null,
      fileType: fileType as FileType | undefined,
      senderId: user.id,
      courseId: roomContext.courseId,
      projectId: roomContext.projectId,
      isSupport: roomContext.isSupport,
      createdAt,
    }).catch((error) => {
      logger.error("Failed to persist message to database", {
        messageId,
        userId: user.id,
        roomId,
        error: error instanceof Error ? error.message : "unknown",
      });

      // إشعار المُرسِل بفشل الحفظ (للـ UI أن يُظهر علامة تحذير)
      socket.emit("server_error", {
        code: "MESSAGE_PERSIST_FAILED",
        message: `Message ${tempId} could not be saved. It may be lost on page refresh.`,
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("Message broadcasted", {
      messageId,
      userId: user.id,
      roomId,
      contentLength: trimmedContent.length,
      hasAttachment: !!fileUrl,
    });
  });

  // ── Typing indicators ──────────────────────────────────────────────────────
  socket.on("typing_start", ({ roomId }) => {
    if (socket.rooms.has(roomId)) {
      socket.to(roomId).emit("user_typing", {
        userId: user.id,
        userName: user.name,
        roomId,
      });
    }
  });

  socket.on("typing_stop", ({ roomId }) => {
    if (socket.rooms.has(roomId)) {
      socket.to(roomId).emit("user_stopped_typing", {
        userId: user.id,
        userName: user.name,
        roomId,
      });
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RoomContext {
  courseId: string | null;
  projectId: string | null;
  isSupport: boolean;
}

function parseRoomContext(roomId: string, userId: string): RoomContext | null {
  if (roomId.startsWith("course-study-group-")) {
    return {
      courseId: roomId.replace("course-study-group-", ""),
      projectId: null,
      isSupport: false,
    };
  }

  if (roomId.startsWith("project-workspace-")) {
    return {
      courseId: null,
      projectId: roomId.replace("project-workspace-", ""),
      isSupport: false,
    };
  }

  if (roomId.startsWith("support-channel-")) {
    return {
      courseId: null,
      projectId: null,
      isSupport: true,
    };
  }

  return null;
}

interface PersistMessageParams {
  messageId: string;
  content: string;
  fileUrl: string | null;
  fileType?: FileType;
  senderId: string;
  courseId: string | null;
  projectId: string | null;
  isSupport: boolean;
  createdAt: Date;
}

async function persistMessageToDatabase(
  params: PersistMessageParams
): Promise<void> {
  await prisma.message.create({
    data: {
      id: params.messageId,
      content: params.content,
      fileUrl: params.fileUrl,
      fileType: params.fileType ?? null,
      senderId: params.senderId,
      courseId: params.courseId,
      projectId: params.projectId,
      isSupport: params.isSupport,
      isSystem: false,
      createdAt: params.createdAt,
    },
  });
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const key = userId;
  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_MESSAGES) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count++;
  return { allowed: true };
}