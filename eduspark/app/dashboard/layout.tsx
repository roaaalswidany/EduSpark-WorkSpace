import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { DashboardShell } from "./_components/dashboard-shell";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import { getLevelProgress } from "@/lib/gamification/levels";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";

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
        emailVerified: true,
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
    <AuthSessionProvider>
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
      {!user.emailVerified && <VerifyEmailBanner />}
      {children}
    </DashboardShell>
    </AuthSessionProvider>
  );
}