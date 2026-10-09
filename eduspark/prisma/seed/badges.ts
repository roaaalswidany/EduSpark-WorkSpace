// eduspark/prisma/seed/badges.ts
import type { PrismaClient } from "@prisma/client";
import { BADGE_CATALOG } from "../../lib/gamification/badges";
import { logHeader, logSuccess } from "./helpers";

export async function seedBadges(db: PrismaClient) {
  logHeader("🎖️  Step X: Badges");

  await db.badge.deleteMany({});

  for (const badge of BADGE_CATALOG) {
    await db.badge.create({
      data: {
        key: badge.key,
        name: badge.name,
        nameAr: badge.nameAr,
        description: badge.description,
        descriptionAr: badge.descriptionAr,
        icon: badge.icon,
        tier: badge.tier,
        xpReward: badge.xpReward,
      },
    });
  }

  logSuccess(`${BADGE_CATALOG.length} badges seeded`);
}