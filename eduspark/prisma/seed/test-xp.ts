// eduspark/prisma/seed/test-xp.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getLevelForXP, getLevelProgress } from "../../lib/gamification/levels";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main() {
  console.log("\n📊 User XP Leaderboard (Top 10):\n");

  const stats = await db.userStats.findMany({
    select: {
      userId: true,
      xp: true,
      level: true,
      currentStreak: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { xp: "desc" },
    take: 10,
  });

  if (stats.length === 0) {
    console.log("   (No user stats yet — complete a lesson/quiz to trigger XP)");
  } else {
    stats.forEach((s, i) => {
      const progress = getLevelProgress(s.xp);
      console.log(`   ${i + 1}. ${s.user.name.padEnd(20)} ${s.xp} XP | ${s.level} | ${progress.progressPct}% to next`);
    });
  }

  console.log(`\n🎖️  Total UserStats rows: ${await db.userStats.count()}`);
  console.log(`🎖️  Total UserBadges: ${await db.userBadge.count()}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });