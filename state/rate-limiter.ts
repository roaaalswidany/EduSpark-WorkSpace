// ─── Sliding-window rate limiter ──────────────────────────────────────────────
// Tracks per-user message timestamps over a rolling 60-second window.
// Automatically purges stale buckets to prevent unbounded memory growth.

interface Bucket {
  timestamps: number[];
  warningIssued: boolean;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000; // 1 minute
  private cleanupTimer: NodeJS.Timeout;

  constructor(private readonly maxRequests: number = 30) {
    // Periodic cleanup of expired buckets (every 5 minutes)
    this.cleanupTimer = setInterval(() => this.purgeExpired(), 5 * 60_000).unref();
  }

  // ── Check & record ────────────────────────────────────────────────────────

  check(userId: string): {
    allowed: boolean;
    remaining: number;
    resetInMs: number;
    isWarning: boolean;
  } {
    const now = Date.now();
    const bucket = this.getOrCreate(userId);

    // Slide the window: keep only timestamps within the last 60s
    bucket.timestamps = bucket.timestamps.filter(
      (ts) => now - ts < this.windowMs
    );

    const count = bucket.timestamps.length;
    const remaining = Math.max(0, this.maxRequests - count);
    const oldestTs = bucket.timestamps[0] ?? now;
    const resetInMs = Math.max(0, this.windowMs - (now - oldestTs));

    if (count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetInMs, isWarning: false };
    }

    bucket.timestamps.push(now);

    // Warn when approaching limit (80% consumed)
    const isWarning = !bucket.warningIssued && count >= Math.floor(this.maxRequests * 0.8);
    if (isWarning) bucket.warningIssued = true;

    return { allowed: true, remaining: remaining - 1, resetInMs, isWarning };
  }

  // ── Reset on successful disconnect (optional fairness) ────────────────────

  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private getOrCreate(userId: string): Bucket {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { timestamps: [], warningIssued: false };
      this.buckets.set(userId, bucket);
    }
    return bucket;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [userId, bucket] of this.buckets) {
      const active = bucket.timestamps.filter((ts) => now - ts < this.windowMs);
      if (active.length === 0) {
        this.buckets.delete(userId);
      } else {
        bucket.timestamps = active;
        bucket.warningIssued = false; // reset warning for next window
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.buckets.clear();
  }
}

// Singleton — import and use across handlers
export const rateLimiter = new SlidingWindowRateLimiter(
  Number(process.env.MAX_MESSAGES_PER_MINUTE ?? 30)
);