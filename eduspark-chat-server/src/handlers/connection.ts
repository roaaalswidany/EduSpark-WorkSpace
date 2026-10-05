// ============================================================================
// معالج أحداث الاتصال والانقطاع
// ============================================================================

import type { TypedSocket, TypedServer } from "../types/socket.types";
import { logger } from "../lib/logger";
import { env } from "../config/env";

// تتبّع المستخدمين المتصلين في الذاكرة
const connectedUsers = new Map<string, Set<string>>(); // userId → Set<socketId>

export function registerConnectionHandlers(
  socket: TypedSocket,
  io: TypedServer
): void {
  const user = socket.data.user;

  // ── تسجيل الاتصال الجديد ──────────────────────────────────────────────────
  if (!connectedUsers.has(user.id)) {
    connectedUsers.set(user.id, new Set());
  }
  connectedUsers.get(user.id)!.add(socket.id);

  const totalConnections = connectedUsers.get(user.id)!.size;

  logger.info("New socket connection", {
    socketId: socket.id,
    userId: user.id,
    userName: user.name,
    role: user.role,
    totalUserConnections: totalConnections,
    totalConnectedUsers: connectedUsers.size,
  });

  // إرسال تأكيد الاتصال للعميل
  socket.emit("connection_acknowledged", {
    userId: user.id,
    connectedAt: socket.data.connectedAt.toISOString(),
    serverVersion: process.env["npm_package_version"] ?? "1.0.0",
  });

  // ── معالجة الانقطاع ───────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    const userSockets = connectedUsers.get(user.id);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        connectedUsers.delete(user.id);
      }
    }

    const sessionDurationSeconds = Math.floor(
      (Date.now() - socket.data.connectedAt.getTime()) / 1000
    );

    logger.info("Socket disconnected", {
      socketId: socket.id,
      userId: user.id,
      reason,
      sessionDurationSeconds,
      activeRooms: Array.from(socket.data.activeRooms),
      remainingConnections: userSockets?.size ?? 0,
    });
  });

  // ── معالجة الأخطاء ────────────────────────────────────────────────────────
  socket.on("error", (error) => {
    logger.error("Socket error", {
      socketId: socket.id,
      userId: user.id,
      error: error.message,
    });
  });
}

export function getConnectedUsersCount(): number {
  return connectedUsers.size;
}

export function getTotalConnectionsCount(): number {
  let total = 0;
  connectedUsers.forEach((sockets) => (total += sockets.size));
  return total;
}