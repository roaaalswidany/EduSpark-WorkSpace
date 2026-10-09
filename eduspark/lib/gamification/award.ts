// eduspark/lib/gamification/award.ts
import type { PrismaClient } from "@prisma/client";
import { db, db as defaultDb } from "@/lib/db";
import { XP_REWARDS, type XPReason } from "./xp-rules";
import { getLevelForXP, getLevelProgress } from "./levels";
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
    // ── 1. Upsert UserStats ────────────────────────────────────────
    const previousStats = await db.userStats.upsert({
      where: { userId },
      create: {
        userId,
        xp: 0,
        level: "BRONZE",
      },
      update: {},
      select: { xp: true, level: true },
    });

    const previousLevel = previousStats.level;
    const newTotalXP = previousStats.xp + xpGained;
    const newLevel = getLevelForXP(newTotalXP).key;
    const leveledUp = newLevel !== previousLevel;

    // ── 2. Update XP + Level + lastActiveDate ─────────────────────
    await db.userStats.update({
      where: { userId },
      data: {
        xp: newTotalXP,
        level: newLevel,
        lastActiveDate: new Date(),
      },
    });

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