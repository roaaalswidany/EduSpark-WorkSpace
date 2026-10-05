// ============================================================================
// معالج أحداث الغرف (join_room, leave_room)
// ============================================================================

import type { TypedSocket, TypedServer } from "../types/socket.types";
import { parseRoomIdentifier, verifyRoomAccess } from "../guards/room-access";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { MessageBroadcastPayload } from "../types/socket.types";

const RECENT_MESSAGES_LIMIT = 50;

export function registerRoomHandlers(
  socket: TypedSocket,
  io: TypedServer
): void {
  const user = socket.data.user;

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on("join_room", async (payload, callback) => {
    const { roomType, targetId } = payload;

    if (!roomType || !targetId) {
      return callback({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "roomType and targetId are required.",
        },
      });
    }

    // تنظيف وتحليل معرّف الغرفة
    const parsed = parseRoomIdentifier(roomType, targetId);

    logger.debug("Room join attempt", {
      socketId: socket.id,
      userId: user.id,
      roomId: parsed.fullRoomId,
    });

    // التحقّق من حق الوصول عبر قاعدة البيانات
    const accessResult = await verifyRoomAccess(user, parsed);

    if (!accessResult.granted) {
      logger.warn("Room join denied", {
        socketId: socket.id,
        userId: user.id,
        roomId: parsed.fullRoomId,
        reason: accessResult.code,
      });

      return callback({
        success: false,
        error: {
          code: accessResult.code,
          message: accessResult.message,
        },
      });
    }

    // الانضمام للغرفة في Socket.io
    await socket.join(parsed.fullRoomId);
    socket.data.activeRooms.add(parsed.fullRoomId);

    // إشعار أعضاء الغرفة بالانضمام الجديد
    socket.to(parsed.fullRoomId).emit("user_joined_room", {
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      roomId: parsed.fullRoomId,
      timestamp: new Date().toISOString(),
    });

    // جلب آخر الرسائل للـ room history
    const recentMessages = await fetchRecentMessages(parsed);

    const membersCount = getSocketsInRoom(io, parsed.fullRoomId);

    logger.info("User joined room", {
      socketId: socket.id,
      userId: user.id,
      roomId: parsed.fullRoomId,
      membersCount,
    });

    callback({
      success: true,
      data: {
        roomId: parsed.fullRoomId,
        membersCount,
        recentMessages,
      },
    });
  });

  // ── leave_room ─────────────────────────────────────────────────────────────
  socket.on("leave_room", async (payload, callback) => {
    const { roomId } = payload;

    if (!socket.rooms.has(roomId)) {
      return callback({
        success: false,
        error: {
          code: "NOT_IN_ROOM",
          message: "You are not a member of this room.",
        },
      });
    }

    await socket.leave(roomId);
    socket.data.activeRooms.delete(roomId);

    socket.to(roomId).emit("user_left_room", {
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      roomId,
      timestamp: new Date().toISOString(),
    });

    logger.info("User left room", {
      socketId: socket.id,
      userId: user.id,
      roomId,
    });

    callback({ success: true, data: null });
  });

  // ── ping_room ──────────────────────────────────────────────────────────────
  socket.on("ping_room", (payload, callback) => {
    const { roomId } = payload;

    if (!socket.rooms.has(roomId)) {
      return callback({
        success: false,
        error: { code: "NOT_IN_ROOM", message: "You are not in this room." },
      });
    }

    callback({
      success: true,
      data: {
        roomId,
        membersCount: getSocketsInRoom(io, roomId),
        isActive: true,
      },
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSocketsInRoom(io: TypedServer, roomId: string): number {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

async function fetchRecentMessages(
  parsed: ReturnType<typeof parseRoomIdentifier>
): Promise<MessageBroadcastPayload[]> {
  try {
    const whereClause = buildMessageWhereClause(parsed);

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: RECENT_MESSAGES_LIMIT,
      select: {
        id: true,
        content: true,
        fileUrl: true,
        fileType: true,
        isSystem: true,
        createdAt: true,
        senderId: true,
        courseId: true,
        projectId: true,
        isSupport: true,
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
    });

    // عكس الترتيب: من الأقدم للأحدث للعرض الصحيح
    return messages.reverse().map((msg) => ({
      id: msg.id,
      tempId: msg.id, // للرسائل التاريخية نستخدم الـ id الفعلي
      content: msg.content,
      fileUrl: msg.fileUrl,
      fileType: msg.fileType,
      senderId: msg.sender.id,
      senderName: msg.sender.name,
      senderImage: msg.sender.image,
      senderRole: msg.sender.role,
      roomId: parsed.fullRoomId,
      courseId: msg.courseId,
      projectId: msg.projectId,
      isSupport: msg.isSupport,
      isSystem: msg.isSystem,
      createdAt: msg.createdAt.toISOString(),
    }));
  } catch (error) {
    logger.error("Error fetching recent messages", {
      roomType: parsed.type,
      targetId: parsed.targetId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

function buildMessageWhereClause(
  parsed: ReturnType<typeof parseRoomIdentifier>
): Record<string, unknown> {
  switch (parsed.type) {
    case "course-study-group":
      return { courseId: parsed.targetId };
    case "project-workspace":
      return { projectId: parsed.targetId };
    case "support-channel":
      return {
        isSupport: true,
        senderId: parsed.targetId, // targetId هنا هو userId
      };
    default:
      return {};
  }
}