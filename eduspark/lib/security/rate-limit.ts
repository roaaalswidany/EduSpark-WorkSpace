// eduspark/lib/security/rate-limit.ts
import { Redis } from "ioredis";

// ─── Redis Client (singleton) ─────────────────────────────────────
// Uses its own connection to keep rate limiting independent from cache.

const globalForRateLimit = globalThis as unknown as {
  rateLimitRedis: Redis | undefined;
};

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[RATE_LIMIT] REDIS_URL not set — rate limiting disabled");
    return null;
  }

  if (!globalForRateLimit.rateLimitRedis) {
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    client.on("error", (err) => {
      console.warn("[RATE_LIMIT] Redis error:", err.message);
    });

    globalForRateLimit.rateLimitRedis = client;
  }

  return globalForRateLimit.rateLimitRedis;
}

// ─── Types ────────────────────────────────────────────────────────

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSec: number;
}

// ─── Presets ─────────────────────────────────────────────────────
// OWASP ASVS v4.0 recommends 5 failed login attempts per 15 minutes.
// In development, the IP limit is relaxed to allow testing multiple
// accounts from the same machine without manual Redis resets.

const IS_PROD = process.env.NODE_ENV === "production";

export const RateLimits = {
  /** AI chat: 20 messages / 5 minutes */
  AI_CHAT: { key: "ai-chat", limit: 20, windowSec: 300 },

  /** Login attempts per email: 5 per 15 minutes (OWASP standard) */
  AUTH_LOGIN: { key: "auth-login", limit: 5, windowSec: 900 },

  /** Login attempts per IP: strict in production, relaxed in dev */
  AUTH_LOGIN_IP: {
    key: "auth-login-ip",
    limit: IS_PROD ? 5 : 100,
    windowSec: 900,
  },

  /** Register: 3 per hour */
  AUTH_REGISTER: { key: "auth-register", limit: 3, windowSec: 3600 },

  /** General API writes: 60 per minute */
  API_WRITE: { key: "api-write", limit: 60, windowSec: 60 },

  /** Server actions (sensitive): 30 per minute */
  ACTION_SENSITIVE: { key: "action-sensitive", limit: 30, windowSec: 60 },
} as const;

// ─── Core: Sliding Window ────────────────────────────────────────

export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (!redis) {
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: Date.now() + config.windowSec * 1000,
      retryAfterSec: 0,
    };
  }

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${config.key}:${identifier}`;

  try {
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    const member = `${now}-${Math.random().toString(36).slice(2, 9)}`;
    pipeline.zadd(redisKey, now, member);
    pipeline.zcard(redisKey);
    pipeline.expire(redisKey, config.windowSec);

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Pipeline returned null");
    }

    const count = (results[2]?.[1] as number) ?? 0;

    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);
    const resetAt = now + windowMs;
    const retryAfterSec = allowed ? 0 : Math.ceil(windowMs / 1000);

    return {
      allowed,
      remaining,
      limit: config.limit,
      resetAt,
      retryAfterSec,
    };
  } catch (err) {
    console.error("[RATE_LIMIT] check failed:", err);
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: now + windowMs,
      retryAfterSec: 0,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

export function getClientIdentifier(
  headers: Headers,
  userId?: string | null
): string {
  if (userId) return `user:${userId}`;

  const forwarded = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? "unknown";

  return `ip:${ip}`;
}

export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSec);
  }

  return headers;
}