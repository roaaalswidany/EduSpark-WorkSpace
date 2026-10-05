// ============================================================================
// التحقّق من JWT الصادر عن NextAuth
//
// الاستراتيجية الأمنية:
// NextAuth تُصدر JWT موقَّعاً بـ HMAC-SHA256 باستخدام NEXTAUTH_SECRET.
// خادم الدردشة يُفكِّكه بنفس المفتاح (JWT_SECRET في .env).
// لا يوجد اتصال شبكي بين الخادمَين — التحقّق تشفيري محلي بالكامل.
// ============================================================================

import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "./logger";
import type { Role } from "@prisma/client";

export interface DecodedNextAuthToken {
  sub: string;           // user.id
  email: string;
  name: string;
  role: Role;
  picture: string | null;
  iat: number;
  exp: number;
  jti?: string;
}

export type JWTVerificationResult =
  | { success: true; payload: DecodedNextAuthToken }
  | { success: false; reason: "EXPIRED" | "INVALID" | "MALFORMED" | "MISSING_CLAIMS" };

/**
 * يُفكِّك ويتحقّق من صحة JWT الصادر عن NextAuth
 *
 * الأسباب التي تجعل هذه الدالة آمنة:
 * 1. algorithms: ["HS256"] يمنع هجوم Algorithm Confusion
 * 2. التحقّق من انتهاء الصلاحية exp يحدث تلقائياً في jwt.verify
 * 3. نتحقّق من الحقول الإلزامية sub و role بعد الفكّ
 */
export function verifyNextAuthToken(rawToken: string): JWTVerificationResult {
  if (!rawToken || typeof rawToken !== "string" || rawToken.split(".").length !== 3) {
    return { success: false, reason: "MALFORMED" };
  }

  try {
    const decoded = jwt.verify(rawToken, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as DecodedNextAuthToken;

    // التحقّق من الحقول الإلزامية
    if (!decoded.sub || typeof decoded.sub !== "string") {
      logger.warn("JWT missing sub claim");
      return { success: false, reason: "MISSING_CLAIMS" };
    }

    if (!decoded.role || !["STUDENT", "CREATOR", "ADMIN"].includes(decoded.role)) {
      logger.warn("JWT has invalid role claim", { role: decoded.role });
      return { success: false, reason: "MISSING_CLAIMS" };
    }

    if (!decoded.email) {
      logger.warn("JWT missing email claim");
      return { success: false, reason: "MISSING_CLAIMS" };
    }

    return { success: true, payload: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { success: false, reason: "EXPIRED" };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { success: false, reason: "INVALID" };
    }

    logger.error("Unexpected JWT verification error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { success: false, reason: "INVALID" };
  }
}

/**
 * يستخرج التوكن من handshake socket
 * يقبل التوكن من: auth.token أو Authorization header
 */
export function extractTokenFromHandshake(
  auth: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>
): string | null {
  // المصدر الأوّل: socket.handshake.auth.token (الطريقة المُفضَّلة)
  if (auth["token"] && typeof auth["token"] === "string") {
    return auth["token"];
  }

  // المصدر الثاني: Authorization header (Bearer token)
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer" && parts[1]) {
      return parts[1];
    }
  }

  return null;
}