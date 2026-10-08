// eduspark/lib/cache.ts
import Redis from "ioredis";

// ─── Redis Client (singleton via globalThis) ─────────────────────
// Using globalThis prevents Next.js dev hot-reload from creating
// multiple clients.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[CACHE] REDIS_URL not set — caching disabled");
    return null;
  }

  if (!globalForRedis.redis) {
    // v5 handles URL with password natively (like chat-server).
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });

    client.on("error", (err) => {
      console.warn("[CACHE] Redis error:", err.message);
    });

    client.on("connect", () => {
      console.log("[CACHE] Redis connected");
    });

    client.on("ready", () => {
      console.log("[CACHE] Redis ready");
    });

    globalForRedis.redis = client;
  }

  return globalForRedis.redis;
}

// ─── Types ────────────────────────────────────────────────────────

export interface CacheOptions {
  ttl: number;
}

// ─── Get / Set / Invalidate ──────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[CACHE] get(${key}) failed — falling back to DB`);
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", options.ttl);
  } catch {
    console.warn(`[CACHE] set(${key}) failed`);
  }
}

export async function cacheInvalidate(keys: string[]): Promise<void> {
  const client = getRedis();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch {
    console.warn(`[CACHE] invalidate(${keys.join(",")}) failed`);
  }
}

export async function cacheInvalidatePattern(
  pattern: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = next;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    console.warn(`[CACHE] invalidatePattern(${pattern}) failed`);
  }
}

// ─── High-level Helper ────────────────────────────────────────────

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cachedValue = await cacheGet<T>(key);
  if (cachedValue !== null) {
    return cachedValue;
  }
  const fresh = await fetcher();
  void cacheSet(key, fresh, { ttl: ttlSeconds });
  return fresh;
}