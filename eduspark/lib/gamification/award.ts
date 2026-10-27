// eduspark/lib/gamification/award.ts
import type { PrismaClient } from "@prisma/client";
import { db, db as defaultDb } from "@/lib/db";
import { XP_REWARDS, type XPReason } from "./xp-rules";
import { getLevelForXP, getLevelProgress } from "./levels";
import { nextStreak } from "@/lib/gamification/streak";
import { checkAndAwardBadges, type EarnedBadge } from "./check-badges";

// ─── Types ────────────────────────────────────────────────────────

export interface AwardResult {
  xpGained: number;
  newTotalXP: number;
  previousLevel: string;
  newLevel: string;
  leveledUp: boolean;
  earnedBadges: EarnedBadge[];
}

export interface AwardOptions {
  /** Optional Prisma transaction client (for consistency) */
  tx?: PrismaClient;
  /** Skip badge checks (for fast path when we know no badge applies) */
  skipBadges?: boolean;
}

// ─── Main Function ────────────────────────────────────────────────

/**
 * Award XP to a user for a specific reason, update their level,
 * and (by default) check for newly earned badges.
 *
 * This is designed to be **fire-and-forget safe**: if it fails,
 * the calling action should still succeed. Wrap calls in `.catch()`
 * when using outside a transaction.
 */
export async function awardXP(
  userId: string,
  reason: XPReason,
  options: AwardOptions = {}
): Promise<AwardResult | null> {
  const db = options.tx ?? defaultDb;
  const xpGained = XP_REWARDS[reason];

  if (xpGained <= 0) return null;

  try {
    // ── 1. Atomic increment (no read-modify-write → no lost updates) ──
    const now = new Date();
    // Streak: concurrent awards on the same day compute identical values, so
    // writing the absolute result is safe (unlike xp, which uses increment).
    const previous = await db.userStats.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
    });
    const streak = nextStreak(previous, now);
    const bumped = await db.userStats.upsert({
      where: { userId },
      create: {
        userId,
        xp: xpGained,
        level: getLevelForXP(xpGained).key,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDate: now,
      },
      update: {
        xp: { increment: xpGained },
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDate: now,
      },
      select: { xp: true, level: true },
    });

    const newTotalXP = bumped.xp;
    const newLevel = getLevelForXP(newTotalXP).key;
    const previousLevel = getLevelForXP(newTotalXP - xpGained).key;
    const leveledUp = newLevel !== previousLevel;

    // ── 2. Keep the stored level in sync with the new XP total ────
    if (bumped.level !== newLevel) {
      await db.userStats.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    // ── 3. Check badges (optional) ────────────────────────────────
    let earnedBadges: EarnedBadge[] = [];
    if (!options.skipBadges) {
      try {
        earnedBadges = await checkAndAwardBadges(userId, db);
      } catch (err) {
        console.error("[GAMIFICATION] Badge check failed:", err);
        // Non-fatal — continue
      }
    }

    return {
      xpGained,
      newTotalXP,
      previousLevel,
      newLevel,
      leveledUp,
      earnedBadges,
    };
  } catch (err) {
    console.error(`[GAMIFICATION] awardXP failed for user=${userId}:`, err);
    return null;
  }
}

// ─── Helper for UI ────────────────────────────────────────────────

/**
 * Get the full XP/level summary for a user (creates stats if missing).
 */
export async function getUserStats(userId: string) {
  const stats = await db.userStats.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: {
      xp: true,
      level: true,
      currentStreak: true,
      longestStreak: true,
    },
  });

  const progress = getLevelProgress(stats.xp);

  return {
    ...stats,
    progress,
  };
}