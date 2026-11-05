import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("rate-limit fail-closed behavior", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.RATE_LIMIT_FAIL_CLOSED;
    // Remove REDIS_URL to force "no redis" branch
    delete process.env.REDIS_URL;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.RATE_LIMIT_FAIL_CLOSED;
    else process.env.RATE_LIMIT_FAIL_CLOSED = originalEnv;
    vi.resetModules();
  });

  it("fails open when RATE_LIMIT_FAIL_CLOSED is not 'true'", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "false";
    const { checkRateLimit, RateLimits } = await import("@/lib/security/rate-limit");
    const result = await checkRateLimit(RateLimits.API_WRITE, "test-user");
    expect(result.allowed).toBe(true);
  });

  it("fails closed when RATE_LIMIT_FAIL_CLOSED is 'true'", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    const { checkRateLimit, RateLimits } = await import("@/lib/security/rate-limit");
    const result = await checkRateLimit(RateLimits.API_WRITE, "test-user");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });
});