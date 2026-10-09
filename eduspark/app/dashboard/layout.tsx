import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { DashboardShell } from "./_components/dashboard-shell";
import { getLevelProgress } from "@/lib/gamification/levels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const [user, unreadCount, stats] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    }),
    db.notification.count({
      where: { userId, isRead: false },
    }),
    db.userStats.findUnique({
      where: { userId },
      select: { xp: true, level: true },
    }),
  ]);

  if (!user) redirect("/auth/login");

  const xp = stats?.xp ?? 0;
  const levelProgress = getLevelProgress(xp);

  return (
    <DashboardShell
      role={user.role}
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      }}
      unreadNotifications={unreadCount}
      gamification={{
        xp,
        level: levelProgress.current.key,
        levelLabel: levelProgress.current.label,
        levelIcon: levelProgress.current.icon,
        levelColor: levelProgress.current.color,
        levelBg: levelProgress.current.bg,
        levelBorder: levelProgress.current.border,
        levelGradient: levelProgress.current.gradient,
        progressPct: levelProgress.progressPct,
        xpToNext: levelProgress.xpToNext,
        nextLevelLabel: levelProgress.next?.label ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}