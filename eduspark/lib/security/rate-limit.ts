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
  /** Unique identifier for the limit (e.g. "ai-chat", "login") */
  key: string;
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
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
// Adjustable in one place — used across the app.

export const RateLimits = {
  /** AI chat: 20 messages / 5 minutes */
  AI_CHAT: { key: "ai-chat", limit: 20, windowSec: 300 },
  /** Login attempts: 5 per 15 minutes */
  AUTH_LOGIN: { key: "auth-login", limit: 5, windowSec: 900 },
  /** Register: 3 per hour */
  AUTH_REGISTER: { key: "auth-register", limit: 3, windowSec: 3600 },
  /** General API writes: 60 per minute */
  API_WRITE: { key: "api-write", limit: 60, windowSec: 60 },
  /** Server actions (sensitive): 30 per minute */
  ACTION_SENSITIVE: { key: "action-sensitive", limit: 30, windowSec: 60 },
} as const;

// ─── Core: Sliding Window ────────────────────────────────────────
//
// Algorithm: Redis sorted set (ZSET) where:
//   - Score = timestamp (milliseconds)
//   - Member = unique request ID
//
// On each request:
//   1. Remove entries older than `windowSec` seconds
//   2. Add current request timestamp
//   3. Count remaining entries
//   4. Compare against `limit`
//
// This is a **sliding window** — more accurate than fixed buckets.

export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const redis = getRedis();

  // Fail-open: if Redis is down, allow the request
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

    // 1. Remove old entries (outside window)
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // 2. Add this request (unique member)
    const member = `${now}-${Math.random().toString(36).slice(2, 9)}`;
    pipeline.zadd(redisKey, now, member);

    // 3. Count entries in window
    pipeline.zcard(redisKey);

    // 4. Set expiration (cleanup)
    pipeline.expire(redisKey, config.windowSec);

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Pipeline returned null");
    }

    // results[2] = zcard result → [err, count]
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
    // Fail-open on error
    return {
      allowed: true,
      remaining: config.limit,
      limit: config.limit,
      resetAt: now + windowMs,
      retryAfterSec: 0,
    };
  }
}

// ─── Helper: Get identifier from request ─────────────────────────

export function getClientIdentifier(
  headers: Headers,
  userId?: string | null
): string {
  // Prefer user ID when authenticated (fair per-user limits)
  if (userId) return `user:${userId}`;

  // Fall back to IP for anonymous requests
  const forwarded = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() ?? realIp ?? "unknown";

  return `ip:${ip}`;
}

// ─── Helper: Standard rate-limit response ────────────────────────

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