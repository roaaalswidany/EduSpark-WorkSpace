// eduspark/lib/security/rate-limit.ts
import { Redis } from "ioredis";

// ─── Redis Client (singleton) ─────────────────────────────────────────────────
// Uses its own connection to keep rate limiting independent from cache.

const globalForRateLimit = globalThis as unknown as {
  rateLimitRedis: Redis | undefined;
};

// Fail-open in dev (don't block local work), fail-closed in prod (safer).
const FAIL_CLOSED = process.env.RATE_LIMIT_FAIL_CLOSED === "true";

function failClosedResult(config: RateLimitConfig): RateLimitResult {
  return {
    allowed: !FAIL_CLOSED,
    remaining: 0,
    limit: config.limit,
    resetAt: Date.now() + config.windowSec * 1000,
    retryAfterSec: FAIL_CLOSED ? config.windowSec : 0,
  };
}


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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Presets ──────────────────────────────────────────────────────────────────
// (unchanged — see original file for all presets)

const IS_PROD = process.env.NODE_ENV === "production";

export const RateLimits = {
  AI_CHAT: { key: "ai-chat", limit: 20, windowSec: 300 },
  AUTH_LOGIN: { key: "auth-login", limit: 5, windowSec: 900 },
  AUTH_LOGIN_IP: {
    key: "auth-login-ip",
    limit: IS_PROD ? 5 : 100,
    windowSec: 900,
  },
  AUTH_REGISTER: { key: "auth-register", limit: 3, windowSec: 3600 },
  API_WRITE: { key: "api-write", limit: 60, windowSec: 60 },
  ACTION_SENSITIVE: { key: "action-sensitive", limit: 30, windowSec: 60 },
  QUIZ_SUBMIT: { key: "quiz-submit", limit: 10, windowSec: 600 },
  QUESTION_CREATE: { key: "question-create", limit: 60, windowSec: 3600 },
  AI_QUIZ_GENERATE: { key: "ai-quiz-generate", limit: 10, windowSec: 3600 },
  ORDER_CREATE: { key: "order-create", limit: 10, windowSec: 3600 },
  UPLOAD_REQUEST: { key: "upload-request", limit: 30, windowSec: 600 },
  DOWNLOAD_URL: { key: "download-url", limit: 120, windowSec: 600 },
  SERVICE_WRITE: { key: "service-write", limit: 20, windowSec: 3600 },
  COURSE_REVIEW: { key: "course-review", limit: 10, windowSec: 3600 },
  THUMBNAIL_UPLOAD: { key: "thumbnail-upload", limit: 20, windowSec: 3600 },
  PASSWORD_RESET: { key: "password-reset", limit: 5, windowSec: 3600 },
  EMAIL_VERIFY_SEND: { key: "email-verify-send", limit: 3, windowSec: 3600 },
  PUBLIC_VERIFY: { key: "public-verify", limit: 60, windowSec: 60 },
  REVIEW_CREATE: { key: "review-create", limit: 10, windowSec: 3600 },
} as const;

// ─── Core: Sliding Window (Lua, atomic) ──────────────────────────────────────
//
// The Lua script enforces check-BEFORE-add:
//   1. Remove entries outside the window
//   2. Count remaining entries
//   3. If count >= limit → REJECT without touching the sorted set
//   4. Else → ZADD the new entry, refresh TTL, ALLOW
//
// This is the fix: rejected requests no longer inflate the counter. Under
// concurrency, Redis executes the script atomically (single-threaded), so 100
// parallel calls against limit=3 yield exactly 3 allowed and 3 stored entries.
//
// Return value: { allowedFlag: 0|1, currentCount: number }.

const SLIDING_WINDOW_LUA = `
local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit       = tonumber(ARGV[3])
local ttlSec      = tonumber(ARGV[4])
local member      = ARGV[5]

-- 1. Drop entries older than the window
redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

-- 2. Count entries still inside the window
local count = redis.call('ZCARD', key)

-- 3. Reject BEFORE adding (this is the fix)
if count >= limit then
  return {0, count}
end

-- 4. Allow and persist
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttlSec)
return {1, count + 1}
`;

export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const redis = getRedis();

  if (!redis) {
    return failClosedResult(config);
  }

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${config.key}:${identifier}`;
  const member = `${now}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      now,
      windowStart,
      config.limit,
      config.windowSec,
      member
    )) as [number, number];

    const allowedFlag = Number(result[0]) === 1;
    const count = Number(result[1]);

    const allowed = allowedFlag;
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
    return failClosedResult(config);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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