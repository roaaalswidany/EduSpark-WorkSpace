import type { SocketServer, AuthenticatedSocket } from "../types";
import { presenceStore, PresenceStore } from "../state/presence";
import { rateLimiter } from "../state/rate-limiter";
import { logger, securityLogger } from "../lib/logger";

// ─── Connection lifecycle ─────────────────────────────────────────────────────

export function handleConnectionLifecycle(
  io: SocketServer,
  socket: AuthenticatedSocket,
  presence: PresenceStore
): void {
  const { user } = socket.data;

  // ── Register with presence store ─────────────────────────────────────────

  const { isNewlyOnline } = presence.connect(socket.id, user);

  logger.info("Socket connected", {
    meta: {
      socketId: socket.id,
      userId: user.id,
      name: user.name,
      role: user.role,
      recovered: socket.recovered,
      totalConnections: presence.getTotalConnections(),
      onlineUsers: presence.getOnlineUserCount(),
    },
  });

  // ── Broadcast online status to ALL connected clients ─────────────────────
  // Only emit if this is the user's first connection (not a second tab).

  if (isNewlyOnline) {
    socket.broadcast.emit("presence_online", {
      userId: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
      connectedAt: socket.data.connectedAt.toISOString(),
    });
  }

  // ── Handle recovered connections ─────────────────────────────────────────
  // Socket.io connectionStateRecovery may restore room memberships automatically.
  // Acknowledge recovery so the client can reconcile its UI state.

  if (socket.recovered) {
    const recoveredRooms = Array.from(socket.rooms).filter(
      (r) => r !== socket.id
    );

    socket.emit("reconnect_ack", { recoveredRooms });

    logger.info("Socket state recovered", {
      meta: {
        socketId: socket.id,
        userId: user.id,
        recoveredRooms,
      },
    });
  }

  // ── Handle disconnection ─────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    socket.data.lastActivity = new Date();

    const result = presence.disconnect(socket.id);

    logger.info("Socket disconnected", {
      meta: {
        socketId: socket.id,
        userId: user.id,
        reason,
        wasLastSocket: result?.isNowOffline ?? true,
        remainingConnections: presence.getTotalConnections(),
        sessionDurationMs:
          Date.now() - socket.data.connectedAt.getTime(),
      },
    });

    if (result?.isNowOffline) {
      // Broadcast offline to everyone
      socket.broadcast.emit("presence_offline", {
        userId: user.id,
        name: user.name,
        disconnectedAt: new Date().toISOString(),
      });

      // Notify rooms the user was part of
      const joinedRooms = Array.from(socket.data.joinedRooms ?? []);
      for (const roomId of joinedRooms) {
        socket.to(roomId).emit("user_left", {
          roomId,
          userId: user.id,
          name: user.name,
        });
      }

      // Clean up rate limiter bucket on clean disconnect
      if (
        reason === "client namespace disconnect" ||
        reason === "server namespace disconnect"
      ) {
        rateLimiter.reset(user.id);
      }
    }
  });

  // ── Handle socket-level errors ────────────────────────────────────────────

  socket.on("error", (err) => {
    securityLogger.error("Socket error event", {
      meta: {
        socketId: socket.id,
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  });
}