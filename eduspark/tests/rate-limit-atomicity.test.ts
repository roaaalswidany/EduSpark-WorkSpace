import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── In-memory Redis mock (mimics the Lua semantics) ──────────────────────
const mockState = {
  zsets: new Map<string, Map<string, number>>(),
};

vi.mock("ioredis", () => {
  class FakeRedis {
    zsets = mockState.zsets;
    on = () => {};
    async eval(
      _script: string,
      _numKeys: number,
      key: string,
      ...args: unknown[]
    ): Promise<[number, number]> {
      const now = Number(args[0]);
      const windowStart = Number(args[1]);
      const limit = Number(args[2]);
      // args[3] = ttl (unused in mock)
      const member = String(args[4]);

      const zset = this.zsets.get(key) ?? new Map<string, number>();

      // ZREMRANGEBYSCORE
      for (const [m, s] of zset) {
        if (s < windowStart) zset.delete(m);
      }

      const count = zset.size;

      // Reject BEFORE add (the fix)
      if (count >= limit) {
        this.zsets.set(key, zset);
        return [0, count];
      }

      // Allow and add
      zset.set(member, now);
      this.zsets.set(key, zset);
      return [1, count + 1];
    }
  }

  return { Redis: FakeRedis, default: FakeRedis };
});

describe("rate limit atomicity — check-before-add", () => {
  beforeEach(() => {
    mockState.zsets.clear();
    process.env.REDIS_URL = "redis://mock";
    // Clear cached singleton so each test gets a fresh mock
    (globalThis as { rateLimitRedis?: unknown }).rateLimitRedis = undefined;
  });

  it("rejected requests do NOT increase the stored counter", async () => {
    const { checkRateLimit } = await import("@/lib/security/rate-limit");
    const config = { key: "atomic-1", limit: 3, windowSec: 60 };

    // First 3 allowed
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(config, "user-a");
      expect(r.allowed).toBe(true);
    }

    // Next 5 rejected
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(config, "user-a");
      expect(r.allowed).toBe(false);
    }

    // The crucial assertion: exactly 3 stored entries (not 8)
    const zset = mockState.zsets.get("ratelimit:atomic-1:user-a");
    expect(zset?.size).toBe(3);
  });

  it("successful requests still increment; remaining reflects the count", async () => {
    const { checkRateLimit } = await import("@/lib/security/rate-limit");
    const config = { key: "atomic-2", limit: 3, windowSec: 60 };

    const r1 = await checkRateLimit(config, "user-b");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(config, "user-b");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(config, "user-b");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await checkRateLimit(config, "user-b");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSec).toBeGreaterThan(0);
  });

  it("different identifiers share no state", async () => {
    const { checkRateLimit } = await import("@/lib/security/rate-limit");
    const config = { key: "atomic-3", limit: 1, windowSec: 60 };

    expect((await checkRateLimit(config, "u1")).allowed).toBe(true);
    expect((await checkRateLimit(config, "u1")).allowed).toBe(false);
    // Different identifier — fresh budget
    expect((await checkRateLimit(config, "u2")).allowed).toBe(true);
  });
});