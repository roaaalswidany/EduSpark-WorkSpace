import { randomUUID } from "crypto";
import type {
  AuthenticatedSocket,
  SocketServer,
  SendMessagePayload,
  BroadcastMessage,
  AckResponse,
  MessageAckPayload,
  TypingPayload,
  ParsedRoomId,
} from "../types";
import { prisma } from "../lib/prisma";
import { rateLimiter } from "../state/rate-limiter";
import { logger, auditLogger, securityLogger } from "../lib/logger";
import { PresenceStore } from "../state/presence";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 4000;
const TYPING_DEBOUNCE_MS = 5000; // auto-clear typing indicator after 5s

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRoomIdSimple(raw: string): ParsedRoomId | null {
  const sepIdx = raw.indexOf(":");
  if (sepIdx === -1) return null;
  const prefix = raw.slice(0, sepIdx) as ParsedRoomId["prefix"];
  const entityId = raw.slice(sepIdx + 1);
  return entityId ? { prefix, entityId, raw } : null;
}

function sanitizeContent(raw: string): string {
  return raw
    .trim()
    .replace(/\u0000/g, "") // strip null bytes
    .slice(0, MAX_MESSAGE_LENGTH);
}

// ─── Message persistence (non-blocking, fire-and-watch) ───────────────────────
// We broadcast immediately for low latency then persist asynchronously.
// If persistence fails, the sender is notified to rollback the optimistic UI.

async function persistMessage(
  chatRoomId: string,
  senderId: string,
  content: string,
  messageId: string,
  replyToId: string | null
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      id: messageId,
      chatRoomId,
      senderId,
      content,
      isSystem: false,
    },
    select: { id: true }, // minimal select for speed
  });
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function handleMessageEvents(
  io: SocketServer,
  socket: AuthenticatedSocket,
  _presence: PresenceStore
): void {
  const { user } = socket.data;
  const typingTimers = new Map<string, NodeJS.Timeout>(); // roomId → clear timer

  // ── send_message ───────────────────────────────────────────────────────────

  socket.on("send_message", async (payload: SendMessagePayload, ack) => {
    socket.data.lastActivity = new Date();

    // ── 1. Input validation ──────────────────────────────────────────────────

    if (!payload.roomId || !payload.tempId) {
      return ack({
        ok: false,
        error: { code: "INVALID_PAYLOAD", message: "roomId and tempId are required." },
      });
    }

    const content = sanitizeContent(payload.content ?? "");

    if (!content) {
      return ack({
        ok: false,
        error: { code: "MESSAGE_EMPTY", message: "Message content cannot be empty." },
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return ack({
        ok: false,
        error: {
          code: "MESSAGE_TOO_LONG",
          message: `Message exceeds the ${MAX_MESSAGE_LENGTH} character limit.`,
        },
      });
    }

    // ── 2. Sender must be in the room ────────────────────────────────────────

    if (!socket.rooms.has(payload.roomId)) {
      securityLogger.warn("Message sent to room without membership", {
        meta: { userId: user.id, roomId: payload.roomId },
      });
      return ack({
        ok: false,
        error: { code: "FORBIDDEN", message: "You must join the room before sending messages." },
      });
    }

    // ── 3. Rate limiting ─────────────────────────────────────────────────────

    const rateCheck = rateLimiter.check(user.id);

    if (!rateCheck.allowed) {
      securityLogger.warn("Message rate limit exceeded", {
        meta: {
          userId: user.id,
          roomId: payload.roomId,
          resetInMs: rateCheck.resetInMs,
        },
      });
      return ack({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetInMs / 1000)} seconds.`,
        },
      });
    }

    if (rateCheck.isWarning) {
      // Soft warning to client — approaching limit
      socket.emit("server_error", {
        code: "RATE_LIMITED",
        message: `Warning: ${rateCheck.remaining} messages remaining in this minute.`,
      });
    }

    // ── 4. Generate server-assigned message ID ───────────────────────────────

    const messageId = randomUUID();
    const now = new Date();
    const parsed = parseRoomIdSimple(payload.roomId);

    // ── 5. Build broadcast payload ───────────────────────────────────────────

    const broadcastMsg: BroadcastMessage = {
      id: messageId,
      tempId: payload.tempId,
      chatRoomId: payload.roomId,
      content,
      isSystem: false,
      replyToId: payload.replyToId ?? null,
      sender: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
      createdAt: now.toISOString(),
    };

    // ── 6. Acknowledge immediately (optimistic) ──────────────────────────────

    const ackPayload: MessageAckPayload = {
      messageId,
      tempId: payload.tempId,
      createdAt: now.toISOString(),
    };

    ack({ ok: true, data: ackPayload });

    // ── 7. Broadcast to room (exclude sender — they already have it) ─────────

    socket.to(payload.roomId).emit("message_new", broadcastMsg);

    // Also emit to sender's other tabs (if connected on multiple devices)
    socket.emit("message_new", broadcastMsg);

    // ── 8. Audit log — compliance record (includes content) ─────────────────

    auditLogger.info("message_sent", {
      messageId,
      senderId: user.id,
      senderName: user.name,
      roomId: payload.roomId,
      contentLength: content.length,
      content, // retained for legal compliance — see AUDIT_LOG_RETENTION_DAYS
      timestamp: now.toISOString(),
      ip: socket.handshake.address,
    });

    // ── 9. Operational log — no content ─────────────────────────────────────

    logger.info("Message dispatched", {
      meta: {
        messageId,
        userId: user.id,
        roomId: payload.roomId,
        contentLength: content.length,
      },
    });

    // ── 10. Async DB persistence (only for `chat:` rooms) ───────────────────

    if (parsed?.prefix === "chat") {
      persistMessage(
        parsed.entityId,
        user.id,
        content,
        messageId,
        payload.replyToId ?? null
      )
        .then(() => {
          logger.debug("Message persisted to DB", { meta: { messageId } });
          // Confirm persistence to sender (optional UI checkmark)
          socket.emit("message_saved", ackPayload);
        })
        .catch((err) => {
          logger.error("Failed to persist message", {
            meta: {
              messageId,
              userId: user.id,
              roomId: payload.roomId,
              error: err instanceof Error ? err.message : String(err),
            },
          });
          // Notify sender so the client can display a retry/error indicator
          socket.emit("message_error", {
            tempId: payload.tempId,
            error: { code: "SERVER_ERROR", message: "Message could not be saved. Please retry." },
          });
        });
    }
  });

  // ── typing_start ───────────────────────────────────────────────────────────

  socket.on("typing_start", (payload: TypingPayload) => {
    socket.data.lastActivity = new Date();

    if (!socket.rooms.has(payload.roomId)) return;

    // Broadcast to room except sender
    socket.to(payload.roomId).emit("typing_indicator", {
      roomId: payload.roomId,
      userId: user.id,
      name: user.name,
      isTyping: true,
    });

    // Auto-clear typing indicator after TYPING_DEBOUNCE_MS
    const existing = typingTimers.get(payload.roomId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      socket.to(payload.roomId).emit("typing_indicator", {
        roomId: payload.roomId,
        userId: user.id,
        name: user.name,
        isTyping: false,
      });
      typingTimers.delete(payload.roomId);
    }, TYPING_DEBOUNCE_MS);

    typingTimers.set(payload.roomId, timer);
  });

  // ── typing_stop ────────────────────────────────────────────────────────────

  socket.on("typing_stop", (payload: TypingPayload) => {
    if (!socket.rooms.has(payload.roomId)) return;

    const timer = typingTimers.get(payload.roomId);
    if (timer) {
      clearTimeout(timer);
      typingTimers.delete(payload.roomId);
    }

    socket.to(payload.roomId).emit("typing_indicator", {
      roomId: payload.roomId,
      userId: user.id,
      name: user.name,
      isTyping: false,
    });
  });

  // ── Cleanup typing timers on disconnect ───────────────────────────────────

  socket.on("disconnect", () => {
    for (const [roomId, timer] of typingTimers) {
      clearTimeout(timer);
      // Emit final "not typing" to any rooms this socket was part of
      socket.to(roomId).emit("typing_indicator", {
        roomId,
        userId: user.id,
        name: user.name,
        isTyping: false,
      });
    }
    typingTimers.clear();
  });
}