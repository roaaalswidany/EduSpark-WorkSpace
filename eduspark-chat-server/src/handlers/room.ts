// ============================================================================
// Room Handlers — compatible with ChatBox
// ============================================================================

import type { TypedSocket, TypedServer } from "../types/socket.types";
import type {
  JoinRoomPayload,
  LeaveRoomPayload,
  JoinRoomSuccess,
  SocketResponse,
  BroadcastMessage,
  OnlineUserInfo,
} from "../types/socket.types";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const RECENT_MESSAGES_LIMIT = 50;

export function registerRoomHandlers(
  socket: TypedSocket,
  io: TypedServer
): void {
  const user = socket.data.user;

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on(
    "join_room",
    async (
      payload: JoinRoomPayload,
      callback: (response: SocketResponse<JoinRoomSuccess>) => void
    ) => {
      // ── 1. Extract chatRoomId (accept both formats) ─────────────
      let chatRoomId: string | null = null;

      if (payload?.roomId) {
        const colonIdx = payload.roomId.indexOf(":");
        chatRoomId =
          colonIdx >= 0 ? payload.roomId.slice(colonIdx + 1) : payload.roomId;
      } else if (payload?.targetId) {
        chatRoomId = payload.targetId;
      }

      if (!chatRoomId) {
        return callback({
          ok: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "roomId is required.",
          },
        });
      }

      // ── 2. Verify room + participant ────────────────────────────
      const room = await prisma.chatRoom.findUnique({
        where: { id: chatRoomId },
        select: {
          id: true,
          type: true,
          participants: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        return callback({
          ok: false,
          error: {
            code: "ROOM_NOT_FOUND",
            message: "Chat room does not exist.",
          },
        });
      }

      const isParticipant = room.participants.some(
        (p) => p.user.id === user.id
      );

      if (!isParticipant) {
        logger.warn("Room join denied — not a participant", {
          socketId: socket.id,
          userId: user.id,
          roomId: chatRoomId,
        });
        return callback({
          ok: false,
          error: {
            code: "ROOM_ACCESS_DENIED",
            message: "You are not a participant in this room.",
          },
        });
      }

      // ── 3. Join Socket.io room ──────────────────────────────────
      const fullRoomId = `chat:${room.id}`;
      await socket.join(fullRoomId);

      // ── 4. Fetch last N messages ────────────────────────────────
      const rawMessages = await prisma.chatMessage.findMany({
        where: { chatRoomId: room.id },
        orderBy: { createdAt: "desc" },
        take: RECENT_MESSAGES_LIMIT,
        select: {
          id: true,
          content: true,
          isSystem: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      const history: BroadcastMessage[] = rawMessages.reverse().map((m) => ({
        id: m.id,
        tempId: m.id,
        chatRoomId: room.id,
        content: m.content,
        isSystem: m.isSystem,
        sender: {
          id: m.sender.id,
          name: m.sender.name,
          image: m.sender.image,
        },
        replyToId: null,
        createdAt: m.createdAt.toISOString(),
      }));

      // ── 5. Users list ───────────────────────────────────────────
      const users: OnlineUserInfo[] = room.participants.map((p) => ({
        userId: p.user.id,
        name: p.user.name,
        image: p.user.image,
        role: p.user.role,
        connectedAt: new Date().toISOString(),
      }));

      const membersCount =
        io.sockets.adapter.rooms.get(fullRoomId)?.size ?? 1;

      logger.info("User joined room", {
        socketId: socket.id,
        userId: user.id,
        roomId: fullRoomId,
        membersCount,
      });

      callback({
        ok: true,
        data: {
          roomId: fullRoomId,
          users,
          history,
          totalMessages: history.length,
        },
      });
    }
  );

  // ── leave_room ────────────────────────────────────────────────────────────
 socket.on(
  "leave_room",
  async (
    payload: LeaveRoomPayload,
    callback?: (response: SocketResponse<null>) => void
  ) => {
    const { roomId } = payload;

    if (!roomId) {
      callback?.({
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "roomId is required.",
        },
      });
      return;
    }

    if (socket.rooms.has(roomId)) {
      await socket.leave(roomId);

      socket.to(roomId).emit("user_left", {
        roomId,
        userId: user.id,
        name: user.name,
      });
    }

    logger.info("User left room", {
      socketId: socket.id,
      userId: user.id,
      roomId,
    });

    callback?.({ ok: true, data: null });
  }
);}