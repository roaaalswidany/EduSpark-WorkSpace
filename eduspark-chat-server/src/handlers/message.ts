// ============================================================================
// Message Handlers — compatible with ChatBox (message_new event)
// ============================================================================

import { randomUUID } from "crypto";
import type {
  TypedSocket,
  TypedServer,
  SendMessagePayload,
  SocketResponse,
  MessageSentSuccess,
  BroadcastMessage,
} from "../types/socket.types";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function registerMessageHandlers(
  socket: TypedSocket,
  io: TypedServer
): void {
  const user = socket.data.user;

  // ── send_message ──────────────────────────────────────────────────────────
  socket.on(
    "send_message",
    async (
      payload: SendMessagePayload,
      callback: (response: SocketResponse<MessageSentSuccess>) => void
    ) => {
      const { roomId, content, tempId } = payload;

      if (!roomId || typeof roomId !== "string") {
        return callback({
          ok: false,
          error: { code: "INVALID_PAYLOAD", message: "roomId is required." },
        });
      }

      if (!tempId || typeof tempId !== "string") {
        return callback({
          ok: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "tempId is required for message tracking.",
          },
        });
      }

      const trimmedContent = (content ?? "").trim();

      if (!trimmedContent) {
        return callback({
          ok: false,
          error: {
            code: "EMPTY_MESSAGE",
            message: "Message cannot be empty.",
          },
        });
      }

      if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
        return callback({
          ok: false,
          error: {
            code: "MESSAGE_TOO_LONG",
            message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
          },
        });
      }

      if (!socket.rooms.has(roomId)) {
        logger.warn("Message rejected: sender not in room", {
          userId: user.id,
          roomId,
          socketId: socket.id,
        });
        return callback({
          ok: false,
          error: {
            code: "NOT_IN_ROOM",
            message: "You must join the room before sending messages.",
          },
        });
      }

      const rateLimitResult = checkRateLimit(user.id);
      if (!rateLimitResult.allowed) {
        return callback({
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many messages. Please wait ${rateLimitResult.retryAfterSeconds}s.`,
          },
        });
      }

      // Extract chatRoomId — format is "chat:<id>"
      const colonIdx = roomId.indexOf(":");
      if (colonIdx === -1) {
        return callback({
          ok: false,
          error: {
            code: "INVALID_ROOM_ID",
            message: "Room identifier must be in format 'chat:<id>'.",
          },
        });
      }
      const chatRoomId = roomId.slice(colonIdx + 1);

      // Verify room exists + user is participant
      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: chatRoomId },
        select: {
          id: true,
          participants: {
            select: { userId: true },
          },
        },
      });

      if (!chatRoom) {
        return callback({
          ok: false,
          error: {
            code: "ROOM_NOT_FOUND",
            message: "Chat room does not exist.",
          },
        });
      }

      const isParticipant = chatRoom.participants.some(
        (p) => p.userId === user.id
      );
      if (!isParticipant) {
        return callback({
          ok: false,
          error: {
            code: "ROOM_ACCESS_DENIED",
            message: "You are not a participant in this room.",
          },
        });
      }

      const messageId = randomUUID();
      const createdAt = new Date();

      // ── Build broadcast payload (matches ChatBox BroadcastMessage) ─────
      const broadcastPayload: BroadcastMessage = {
        id: messageId,
        tempId,
        chatRoomId: chatRoom.id,
        content: trimmedContent,
        isSystem: false,
        sender: {
          id: user.id,
          name: user.name,
          image: user.image,
        },
        replyToId: null,
        createdAt: createdAt.toISOString(),
      };

      // ⚠️ IMPORTANT: event name is "message_new" (matches ChatBox listener)
      io.to(roomId).emit("message_new", broadcastPayload);

      // ── Ack to sender (immediate) ───────────────────────────────────────
      callback({
        ok: true,
        data: {
          messageId,
          tempId,
          createdAt: createdAt.toISOString(),
        },
      });

      // ── Persist async ───────────────────────────────────────────────────
      persistMessageToDatabase({
        messageId,
        content: trimmedContent,
        senderId: user.id,
        chatRoomId: chatRoom.id,
        createdAt,
      })
        .then(() => {
          socket.emit("message_saved", {
            messageId,
            tempId,
            createdAt: createdAt.toISOString(),
          });
        })
        .catch((error) => {
          logger.error("Failed to persist message", {
            messageId,
            userId: user.id,
            roomId,
            error: error instanceof Error ? error.message : "unknown",
          });

          socket.emit("message_error", {
            tempId,
            error: {
              code: "SERVER_ERROR",
              message: "Message could not be saved.",
            },
          });
        });

      logger.info("Message broadcast", {
        messageId,
        userId: user.id,
        roomId,
        contentLength: trimmedContent.length,
      });
    }
  );

  // ── typing_start ──────────────────────────────────────────────────────────
  socket.on("typing_start", ({ roomId }) => {
    if (roomId && socket.rooms.has(roomId)) {
      socket.to(roomId).emit("typing_indicator", {
        roomId,
        userId: user.id,
        name: user.name,
        isTyping: true,
      });
    }
  });

  // ── typing_stop ───────────────────────────────────────────────────────────
  socket.on("typing_stop", ({ roomId }) => {
    if (roomId && socket.rooms.has(roomId)) {
      socket.to(roomId).emit("typing_indicator", {
        roomId,
        userId: user.id,
        name: user.name,
        isTyping: false,
      });
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PersistMessageParams {
  messageId: string;
  content: string;
  senderId: string;
  chatRoomId: string;
  createdAt: Date;
}

async function persistMessageToDatabase(
  params: PersistMessageParams
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      id: params.messageId,
      content: params.content,
      senderId: params.senderId,
      chatRoomId: params.chatRoomId,
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
  const existing = rateLimitMap.get(userId);

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
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