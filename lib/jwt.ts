import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { securityLogger } from "./logger";
import type { AuthenticatedUser, UserRole } from "../types";

// ─── Raw decoded shape from NextAuth JWT ──────────────────────────────────────

interface NextAuthJWTPayload {
  id: string;
  name?: string;
  email?: string;
  role?: UserRole;
  picture?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

const VALID_ROLES: Set<string> = new Set(["STUDENT", "CREATOR", "ADMIN"]);

// ─── Verify & extract ─────────────────────────────────────────────────────────

export function verifySocketToken(
  rawToken: string,
  socketId: string,
  remoteAddress: string
): AuthenticatedUser {
  // Basic token format sanity check before hitting crypto
  if (!rawToken || rawToken.split(".").length !== 3) {
    securityLogger.warn("Malformed JWT received", {
      meta: { socketId, ip: remoteAddress, tokenLength: rawToken?.length ?? 0 },
    });
    throw new AuthError("MALFORMED_TOKEN", "Invalid token format.");
  }

  let decoded: NextAuthJWTPayload;

  try {
    decoded = jwt.verify(rawToken, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as NextAuthJWTPayload;
  } catch (err) {
    const code = err instanceof jwt.TokenExpiredError
      ? "TOKEN_EXPIRED"
      : err instanceof jwt.NotBeforeError
      ? "TOKEN_NOT_ACTIVE"
      : "TOKEN_INVALID";

    securityLogger.warn("JWT verification failed", {
      meta: {
        code,
        socketId,
        ip: remoteAddress,
        reason: err instanceof Error ? err.message : "unknown",
      },
    });

    throw new AuthError(code, "Authentication token is invalid or expired.");
  }

  // Validate required fields
  if (!decoded.id || typeof decoded.id !== "string") {
    throw new AuthError("INVALID_CLAIMS", "Token is missing required user ID.");
  }

  if (!decoded.role || !VALID_ROLES.has(decoded.role)) {
    throw new AuthError("INVALID_CLAIMS", `Token contains invalid role: ${decoded.role ?? "none"}.`);
  }

  return {
    id: decoded.id,
    name: decoded.name ?? "Unknown",
    email: decoded.email ?? "",
    role: decoded.role,
    image: decoded.picture ?? null,
  };
}

// ─── Typed Auth Error ─────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}