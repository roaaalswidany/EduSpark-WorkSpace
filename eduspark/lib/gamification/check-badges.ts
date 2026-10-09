/* eslint-disable @typescript-eslint/no-unused-vars */
// eduspark/lib/gamification/check-badges.ts
import type { PrismaClient } from "@prisma/client";
import { BADGE_CATALOG } from "./badges";

export interface EarnedBadge {
  id: string;
  key: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  tier: string;
  xpReward: number;
}

// ─── Individual Badge Checks ──────────────────────────────────────

async function checkBadge(
  userId: string,
  badgeKey: string,
  db: PrismaClient
): Promise<boolean> {
  switch (badgeKey) {
    // ─── Learning ─────────────────────────────────────────────
    case "first_lesson": {
      const count = await db.lessonProgress.count({
        where: { enrollment: { userId }, completed: true },
      });
      return count >= 1;
    }
    case "ten_lessons": {
      const count = await db.lessonProgress.count({
        where: { enrollment: { userId }, completed: true },
      });
      return count >= 10;
    }
    case "first_certificate": {
      const count = await db.certificate.count({ where: { userId } });
      return count >= 1;
    }
    case "three_certificates": {
      const count = await db.certificate.count({ where: { userId } });
      return count >= 3;
    }
    case "five_certificates": {
      const count = await db.certificate.count({ where: { userId } });
      return count >= 5;
    }

    // ─── Marketplace ──────────────────────────────────────────
    case "first_service": {
      const count = await db.service.count({
        where: { creatorId: userId, status: "ACTIVE" },
      });
      return count >= 1;
    }
    case "five_orders": {
      const count = await db.order.count({
        where: { sellerId: userId, status: "COMPLETED" },
      });
      return count >= 5;
    }
    case "top_rated": {
      const count = await db.review.count({
        where: { course: { creatorId: userId }, rating: 5 },
      });
      return count >= 1;
    }

    // ─── Engagement ───────────────────────────────────────────
    case "first_chat": {
      const count = await db.chatMessage.count({
        where: { senderId: userId },
      });
      return count >= 1;
    }
    case "week_streak": {
      const stats = await db.userStats.findUnique({
        where: { userId },
        select: { currentStreak: true },
      });
      return (stats?.currentStreak ?? 0) >= 7;
    }
    case "month_streak": {
      const stats = await db.userStats.findUnique({
        where: { userId },
        select: { currentStreak: true },
      });
      return (stats?.currentStreak ?? 0) >= 30;
    }

    // ─── Career Path ──────────────────────────────────────────
    case "first_career_path": {
      const count = await db.careerPath.count({ where: { userId } });
      return count >= 1;
    }
    case "career_path_completed": {
      const count = await db.careerPath.count({
        where: { userId, status: "COMPLETED" },
      });
      return count >= 1;
    }

    default:
      return false;
  }
}

// ─── Main Function ────────────────────────────────────────────────

/**
 * Check all badge conditions for a user, award any newly earned ones.
 * Returns the list of newly earned badges (with XP rewards applied).
 */
export async function checkAndAwardBadges(
  userId: string,
  db: PrismaClient
): Promise<EarnedBadge[]> {
  // Get badges the user already has
  const existing = await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const existingIds = new Set(existing.map((b) => b.badgeId));

  // Fetch all badge definitions from DB
  const allBadges = await db.badge.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      icon: true,
      tier: true,
      xpReward: true,
    },
  });

  // Filter to badges not yet owned
  const candidates = allBadges.filter((b) => !existingIds.has(b.id));

  if (candidates.length === 0) return [];

  // Run all checks in parallel
  const checks = await Promise.all(
    candidates.map(async (badge) => ({
      badge,
      earned: await checkBadge(userId, badge.key, db),
    }))
  );

  const newlyEarned = checks.filter((c) => c.earned).map((c) => c.badge);

  if (newlyEarned.length === 0) return [];

  // ── Award badges + XP bonus ────────────────────────────────────
  let bonusXP = 0;

  for (const badge of newlyEarned) {
    try {
      await db.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      bonusXP += badge.xpReward;
    } catch (err) {
      // Ignore unique constraint (race condition — already awarded)
      console.error(`[GAMIFICATION] Badge award failed (${badge.key}):`, err);
    }
  }

  // Apply XP bonus for badges
  if (bonusXP > 0) {
    await db.userStats.upsert({
      where: { userId },
      create: { userId, xp: bonusXP },
      update: { xp: { increment: bonusXP } },
    });
  }

  return newlyEarned;
}