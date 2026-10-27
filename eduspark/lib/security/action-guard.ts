import { checkRateLimit, type RateLimitConfig } from "@/lib/security/rate-limit";

/**
 * Per-user rate limit for Server Actions.
 * Returns the seconds to wait when limited, or null when the call may proceed.
 * Note: checkRateLimit fails OPEN if Redis is unavailable (see rate-limit.ts).
 */
export async function limitByUser(
  config: RateLimitConfig,
  userId: string
): Promise<number | null> {
  const result = await checkRateLimit(config, `user:${userId}`);
  return result.allowed ? null : result.retryAfterSec;
}
