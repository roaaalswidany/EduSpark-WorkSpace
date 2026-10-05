// ============================================================================
// حارس مصادقة WebSocket — الطبقة الأمنية الأولى
//
// يُنفَّذ هذا الـ middleware مرة واحدة عند كل محاولة اتصال جديدة.
// إن فشل، يُغلَق الاتصال قبل فتحه ولا يحدث أي معالجة إضافية.
// ============================================================================

import type { Socket } from "socket.io";
import {
  verifyNextAuthToken,
  extractTokenFromHandshake,
} from "../lib/jwt";
import { logger } from "../lib/logger";
import type { SocketData } from "../types/socket.types";

type MiddlewareNext = (err?: Error) => void;

// نوع Socket قبل المصادقة (بيانات غير مُكتمَلة بعد)
type UnauthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  Partial<SocketData>
>;

/**
 * socketAuthMiddleware: الحارس الأمني للاتصال
 *
 * سلسلة التحقّق:
 * 1. استخراج JWT من auth.token أو Authorization header
 * 2. التحقّق التشفيري من التوكن باستخدام HMAC-SHA256
 * 3. التحقّق من صحة الحقول الإلزامية (sub, role, email)
 * 4. ربط بيانات المستخدم الموثَّق بكائن الـ socket
 * 5. السماح بالاتصال أو رفضه بخطأ مُفصَّل
 */
export function socketAuthMiddleware(
  socket: UnauthenticatedSocket,
  next: MiddlewareNext
): void {
  const remoteAddress =
    socket.handshake.headers["x-forwarded-for"]?.toString() ??
    socket.handshake.address;

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  logger.debug("Socket connection attempt", {
    socketId: socket.id,
    remoteAddress,
    requestId,
    transport: socket.conn.transport.name,
  });

  // ── الخطوة 1: استخراج التوكن ──────────────────────────────────────────────
  const rawToken = extractTokenFromHandshake(
    socket.handshake.auth as Record<string, unknown>,
    socket.handshake.headers as Record<string, string | string[] | undefined>
  );

  if (!rawToken) {
    logger.warn("Socket rejected: No authentication token provided", {
      socketId: socket.id,
      remoteAddress,
      requestId,
    });

    return next(
      new Error(
        JSON.stringify({
          code: "UNAUTHENTICATED",
          message: "No authentication token provided. Connect with auth: { token: 'your-jwt' }",
        })
      )
    );
  }

  // ── الخطوة 2: التحقّق التشفيري من التوكن ─────────────────────────────────
  const verificationResult = verifyNextAuthToken(rawToken);

  if (!verificationResult.success) {
    const errorMessages: Record<typeof verificationResult.reason, string> = {
      EXPIRED: "Authentication token has expired. Please sign in again.",
      INVALID: "Authentication token is invalid or has been tampered with.",
      MALFORMED: "Authentication token format is incorrect.",
      MISSING_CLAIMS: "Authentication token is missing required user information.",
    };

    logger.warn("Socket rejected: JWT verification failed", {
      socketId: socket.id,
      remoteAddress,
      reason: verificationResult.reason,
      requestId,
    });

    return next(
      new Error(
        JSON.stringify({
          code: "INVALID_TOKEN",
          reason: verificationResult.reason,
          message: errorMessages[verificationResult.reason],
        })
      )
    );
  }

  // ── الخطوة 3: ربط بيانات المستخدم بكائن الـ socket ─────────────────────────
  const { payload } = verificationResult;

  // نستخدم type assertion هنا لأننا نعلم أننا في مرحلة تهيئة البيانات
  (socket as Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>).data = {
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? "Unknown User",
      role: payload.role,
      image: payload.picture ?? null,
    },
    connectedAt: new Date(),
    activeRooms: new Set<string>(),
  };

  logger.info("Socket authenticated successfully", {
    socketId: socket.id,
    userId: payload.sub,
    role: payload.role,
    remoteAddress,
    requestId,
  });

  next();
}