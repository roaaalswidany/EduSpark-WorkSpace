import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types";
import { verifySocketToken, AuthError } from "../lib/jwt";
import { logger, securityLogger } from "../lib/logger";

type RawSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

// ─── Socket.io authentication middleware ──────────────────────────────────────
// Runs before the "connection" event fires.
// Attaches the verified user to socket.data.user.
// Rejects the handshake with an Error if the token is invalid.

export function socketAuthMiddleware(
  socket: RawSocket,
  next: (err?: Error) => void
): void {
  const remoteAddress =
    socket.handshake.headers["x-forwarded-for"]?.toString() ??
    socket.handshake.address;

  // Accept token from handshake.auth.token (preferred) or Authorization header
  const bearerHeader = socket.handshake.headers.authorization;
  const rawToken: string =
    (socket.handshake.auth as Record<string, string>)["token"] ??
    (bearerHeader?.startsWith("Bearer ") ? bearerHeader.slice(7) : undefined) ??
    "";

  if (!rawToken) {
    securityLogger.warn("Socket connection rejected: no token", {
      meta: { socketId: socket.id, ip: remoteAddress },
    });
    return next(new Error("UNAUTHORIZED: Authentication token is required."));
  }

  try {
    const user = verifySocketToken(rawToken, socket.id, remoteAddress);

    // Attach to socket.data for use in all subsequent handlers
    socket.data.user = user;
    socket.data.joinedRooms = new Set<string>();
    socket.data.connectedAt = new Date();
    socket.data.lastActivity = new Date();

    logger.debug("Socket authenticated", {
      meta: {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        ip: remoteAddress,
      },
    });

    next();
  } catch (err) {
    const code = err instanceof AuthError ? err.code : "UNKNOWN";
    const message = err instanceof AuthError ? err.message : "Authentication failed.";

    securityLogger.warn("Socket authentication failed", {
      meta: {
        socketId: socket.id,
        ip: remoteAddress,
        code,
        reason: message,
      },
    });

    next(new Error(`UNAUTHORIZED: ${message}`));
  }
}