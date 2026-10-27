export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar-day index (days since epoch). */
export function utcDay(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/**
 * Pure streak calculation (UTC days):
 *  - first activity ever            → streak = 1
 *  - already active today           → unchanged
 *  - last active yesterday          → streak + 1
 *  - gap of 2+ days                 → resets to 1
 */
export function nextStreak(prev: StreakState | null, now: Date): StreakState {
  if (!prev || !prev.lastActiveDate) {
    return { currentStreak: 1, longestStreak: Math.max(1, prev?.longestStreak ?? 0), lastActiveDate: now };
  }
  const gap = utcDay(now) - utcDay(prev.lastActiveDate);
  let current = prev.currentStreak;
  if (gap <= 0) {
    current = Math.max(1, prev.currentStreak); // same day (or clock skew): unchanged
  } else if (gap === 1) {
    current = prev.currentStreak + 1;
  } else {
    current = 1;
  }
  return {
    currentStreak: current,
    longestStreak: Math.max(prev.longestStreak, current),
    lastActiveDate: now,
  };
}
