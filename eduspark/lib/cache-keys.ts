// eduspark/lib/cache-keys.ts
// Central registry of cache keys. Prevents typos and ensures
// invalidations target the right keys.

export const CacheKeys = {
  // ─── Courses ───────────────────────────────────────────────────
  coursesList: (filters: {
    q?: string;
    category?: string;
    level?: string;
    sort?: string;
    page?: number;
  }): string => {
    const parts = [
      "courses:list",
      filters.q ?? "_",
      filters.category ?? "_",
      filters.level ?? "_",
      filters.sort ?? "newest",
      `p${filters.page ?? 1}`,
    ];
    return parts.join(":");
  },
  coursesCategories: (): string => "courses:categories",

  // ─── Marketplace ───────────────────────────────────────────────
  servicesList: (filters: {
    q?: string;
    category?: string;
    sort?: string;
    page?: number;
  }): string => {
    const parts = [
      "services:list",
      filters.q ?? "_",
      filters.category ?? "_",
      filters.sort ?? "newest",
      `p${filters.page ?? 1}`,
    ];
    return parts.join(":");
  },
  servicesCategories: (): string => "services:categories",

  // ─── Patterns for invalidation ─────────────────────────────────
  patterns: {
    allCourses: "courses:*",
    allServices: "services:*",
  },
} as const;

// ─── TTL Constants (in seconds) ───────────────────────────────────

export const CacheTTL = {
  /** Frequently changing lists */
  short: 30,
  /** Standard lists */
  medium: 60,
  /** Slow-changing reference data */
  long: 300,
  /** Very stable data */
  veryLong: 3600,
} as const;