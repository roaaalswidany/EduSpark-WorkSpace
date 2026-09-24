/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  AuthenticatedSocket,
  SocketServer,
  JoinRoomPayload,
  LeaveRoomPayload,
  AckResponse,
  RoomJoinedPayload,
  RoomUsersPayload,
  BroadcastMessage,
  ParsedRoomId,
  OnlineUserInfo,
} from "../types";
import { prisma } from "../lib/prisma";
import { presenceStore } from "../state/presence";
import { logger, securityLogger } from "../lib/logger";

// ─── Room ID parser ───────────────────────────────────────────────────────────

const VALID_PREFIXES = new Set(["chat", "course", "support"]);

function parseRoomId(raw: string): ParsedRoomId | null {
  const sepIdx = raw.indexOf(":");
  if (sepIdx === -1) return null;

  const prefix = raw.slice(0, sepIdx);
  const entityId = raw.slice(sepIdx + 1);

  if (!VALID_PREFIXES.has(prefix) || !entityId || entityId.length > 200) {
    return null;
  }

  return { prefix: prefix as ParsedRoomId["prefix"], entityId, raw };
}

// ─── Authorization per room type ──────────────────────────────────────────────

async function authorizeRoomAccess(
  userId: string,
  parsed: ParsedRoomId
): Promise<{ allowed: boolean; reason?: string }> {
  switch (parsed.prefix) {
    case "chat": {
      // DB-backed room — user must be a registered participant
      const participant = await prisma.chatRoomParticipant.findUnique({
        where: {
          userId_chatRoomId: {
            userId,
            chatRoomId: parsed.entityId,
          },
        },
        select: { userId: true },
      });

      if (!participant) {
        return { allowed: false, reason: "User is not a participant of this chat room." };
      }
      return { allowed: true };
    }

    case "course": {
      // Enrolled student or the course creator
      const [enrollment, course] = await Promise.all([
        prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: parsed.entityId } },
          select: { id: true },
        }),
        prisma.course.findUnique({
          where: { id: parsed.entityId },
          select: { creatorId: true },
        }),
      ]);

      const allowed = !!(enrollment || course?.creatorId === userId);
      return allowed
        ? { allowed: true }
        : { allowed: false, reason: "User is not enrolled in this course." };
    }

    case "support": {
      // Any authenticated user may join a support room
      return { allowed: true };
    }

    default:
      return { allowed: false, reason: "Unknown room type." };
  }
}

// ─── Load recent message history ──────────────────────────────────────────────

async function loadRoomHistory(
  prefix: ParsedRoomId["prefix"],
  entityId: string,
  limit = 50
): Promise<BroadcastMessage[]> {
  if (prefix !== "chat") {
    // Transient rooms have no persisted history
    return [];
  }

  const messages = await prisma.chatMessage.findMany({
    where: { chatRoomId: entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      content: true,
      isSystem: true,
      createdAt: true,
      senderId: true,
      sender: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  // Reverse to chronological order
  return messages.reverse().map((m) => ({
    id: m.id,
    tempId: m.id, // historical messages use their real ID as tempId
    chatRoomId: entityId,
    content: m.content,
    isSystem: m.isSystem,
    replyToId: null,
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      image: m.sender.image,
    },
    createdAt: m.createdAt.toISOString(),
  }));
}

// ─── Build online user list for a room ───────────────────────────────────────

function getRoomOnlineUsers(io: SocketServer, roomId: string): OnlineUserInfo[] {
  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom) return [];

  const seen = new Set<string>();
  const users: OnlineUserInfo[] = [];

  for (const socketId of socketsInRoom) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket?.data?.user) continue;

    const userId = socket.data.user.id;
    if (seen.has(userId)) continue; // deduplicate multi-tab users
    seen.add(userId);

    const info = presenceStore.getUserInfo(userId);
    if (info) users.push(info);
  }

  return users;
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function handleRoomEvents(
  io: SocketServer,
  socket: AuthenticatedSocket
): void {
  const { user } = socket.data;

  // ── join_room ─────────────────────────────────────────────────────────────

  socket.on("join_room", async (payload: JoinRoomPayload, ack: (arg0: AckResponse<RoomJoinedPayload>) => void) => {
    socket.data.lastActivity = new Date();

    const parsed = parseRoomId(payload.roomId);
    if (!parsed) {
      const resp: AckResponse<never> = {
        ok: false,
        error: { code: "INVALID_PAYLOAD", message: `Invalid room ID format: "${payload.roomId}".` },
      };
      return ack(resp as AckResponse<RoomJoinedPayload>);
    }

    // Authorization check
    try {
      const { allowed, reason } = await authorizeRoomAccess(user.id, parsed);

      if (!allowed) {
        securityLogger.warn("Unauthorized room join attempt", {
          meta: { userId: user.id, roomId: payload.roomId, reason },
        });

        return ack({
          ok: false,
          error: { code: "ROOM_ACCESS_DENIED", message: reason ?? "Access denied." },
        });
      }
    } catch (err) {
      logger.error("Room authorization DB error", {
        meta: {
          userId: user.id,
          roomId: payload.roomId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return ack({
        ok: false,
        error: { code: "SERVER_ERROR", message: "Failed to verify room access." },
      });
    }

    // Don't re-join if already a socket member (idempotent)
    if (socket.rooms.has(payload.roomId)) {
      const users = getRoomOnlineUsers(io, payload.roomId);
      const history = await loadRoomHistory(parsed.prefix, parsed.entityId);
      return ack({ ok: true, data: { roomId: payload.roomId, users, history, totalMessages: history.length } });
    }

    // Join socket room
    await socket.join(payload.roomId);
    socket.data.joinedRooms.add(payload.roomId);

    // Notify others in the room
    socket.to(payload.roomId).emit("user_joined", {
      roomId: payload.roomId,
      user: {
        userId: user.id,
        name: user.name,
        image: user.image,
        role: user.role,
        connectedAt: socket.data.connectedAt.toISOString(),
      },
    });

    // Load and return room state
    try {
      const [history, users] = await Promise.all([
        loadRoomHistory(parsed.prefix, parsed.entityId),
        Promise.resolve(getRoomOnlineUsers(io, payload.roomId)),
      ]);

      logger.info("User joined room", {
        meta: { userId: user.id, roomId: payload.roomId, historyCount: history.length },
      });

      ack({ ok: true, data: { roomId: payload.roomId, users, history, totalMessages: history.length } });
    } catch (err) {
      logger.error("Failed to load room history", {
        meta: {
          userId: user.id,
          roomId: payload.roomId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      // Return without history on DB failure (room is still joined)
      ack({ ok: true, data: { roomId: payload.roomId, users: [], history: [], totalMessages: 0 } });
    }
  });

  // ── leave_room ────────────────────────────────────────────────────────────

  socket.on("leave_room", (payload: LeaveRoomPayload) => {
    socket.data.lastActivity = new Date();

    if (!socket.rooms.has(payload.roomId)) return;

    socket.leave(payload.roomId);
    socket.data.joinedRooms.delete(payload.roomId);

    socket.to(payload.roomId).emit("user_left", {
      roomId: payload.roomId,
      userId: user.id,
      name: user.name,
    });

    logger.info("User left room", {
      meta: { userId: user.id, roomId: payload.roomId },
    });
  });

  // ── get_room_users ────────────────────────────────────────────────────────

 socket.on("get_room_users", (payload, ack) => {
    if (!socket.rooms.has(payload.roomId)) {
      return ack({
        ok: false,
        error: { code: "ROOM_NOT_FOUND", message: "You are not in this room." },
      });
    }

    const users = getRoomOnlineUsers(io, payload.roomId);
    ack({ ok: true, data: { roomId: payload.roomId, users } });
  });
}