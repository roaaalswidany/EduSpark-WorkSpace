/* eslint-disable @typescript-eslint/no-unused-vars */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Award } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getLevelProgress, LEVELS } from "@/lib/gamification/levels";
import { BADGE_CATALOG } from "@/lib/gamification/badges";
import { LevelCard } from "./_components/level-card";
import { BadgesGrid } from "./_components/badges-grid";
import { Leaderboard } from "./_components/leaderboard";

export const metadata = {
  title: "Achievements — EduSpark",
};

export default async function AchievementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const [stats, badges, userBadges, leaderboardData] = await Promise.all([
    db.userStats.findUnique({ where: { userId } }),
    db.badge.findMany({
      orderBy: [{ tier: "asc" }, { key: "asc" }],
    }),
    db.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true },
    }),
    db.userStats.findMany({
      orderBy: { xp: "desc" },
      take: 20,
      select: {
        userId: true,
        xp: true,
        level: true,
        user: { select: { id: true, name: true, image: true } },
      },
    }),
  ]);

  const xp = stats?.xp ?? 0;
  const levelProgress = getLevelProgress(xp);
  const earnedIds = new Set(userBadges.map((ub) => ub.badgeId));

  // Find user's rank
  const userRank =
    leaderboardData.findIndex((u) => u.userId === userId) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2">
          <Award className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Achievements</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Your Journey
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Track your progress, unlock badges, and compete on the leaderboard.
        </p>
      </div>

      {/* Level Card */}
      <LevelCard
        xp={xp}
        levelProgress={levelProgress}
        badgesEarned={userBadges.length}
        badgesTotal={badges.length}
        userRank={userRank}
      />

      {/* Badges */}
      <BadgesGrid
        badges={badges.map((b) => ({
          id: b.id,
          key: b.key,
          name: b.name,
          nameAr: b.nameAr,
          description: b.description,
          descriptionAr: b.descriptionAr,
          icon: b.icon,
          tier: b.tier,
          xpReward: b.xpReward,
          earned: earnedIds.has(b.id),
        }))}
      />

      {/* Leaderboard */}
      <Leaderboard
        entries={leaderboardData.map((u, i) => ({
          rank: i + 1,
          userId: u.user.id,
          name: u.user.name,
          image: u.user.image,
          xp: u.xp,
          level: u.level,
          isCurrentUser: u.userId === userId,
        }))}
      />
    </div>
  );
}