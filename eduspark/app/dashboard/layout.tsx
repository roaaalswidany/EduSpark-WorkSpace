import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  const [user, unreadCount] = await Promise.all([
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
  ]);

  if (!user) redirect("/auth/login");

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
    >
      {children}
    </DashboardShell>
  );
}