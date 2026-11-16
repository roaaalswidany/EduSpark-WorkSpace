import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NotificationsClient } from "./_components/notifications-client";

export const metadata = {
  title: "Notifications — EduSpark",
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        body: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { userId: session.user.id } }),
    db.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildPageUrl(targetPage: number): string {
    return targetPage > 1
      ? `/dashboard/notifications?page=${targetPage}`
      : "/dashboard/notifications";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <Bell className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Inbox</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Notifications
        </h1>
        {total > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            {total} {total === 1 ? "notification" : "notifications"}
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {unreadCount} unread
              </span>
            )}
            {totalPages > 1 && (
              <span className="text-xs text-muted-foreground/70 ml-2">
                آ· Page {page} of {totalPages}
              </span>
            )}
          </p>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Bell className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">All caught up!</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You don&apos;t have any notifications yet. We&apos;ll let you know
            when something important happens.
          </p>
        </div>
      ) : (
        <>
          <NotificationsClient
            notifications={notifications.map((n) => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
            }))}
            unreadCount={unreadCount}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors"
                >
                  ← Previous
                </Link>
              )}

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                if (
                  p === 1 ||
                  p === totalPages ||
                  (p >= page - 1 && p <= page + 1)
                ) {
                  return (
                    <Link
                      key={p}
                      href={buildPageUrl(p)}
                      className={
                        p === page
                          ? "w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                          : "w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border hover:border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                      }
                    >
                      {p}
                    </Link>
                  );
                }
                if (p === page - 2 || p === page + 2) {
                  return (
                    <span key={p} className="text-muted-foreground/70 text-xs">
                      ...
                    </span>
                  );
                }
                return null;
              })}

              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}