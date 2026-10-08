import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

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

  // ── Fetch paginated + total in parallel ────────────────────────
  const [notifications, total] = await Promise.all([
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
    db.notification.count({
      where: { userId: session.user.id },
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
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <Bell className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Inbox</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Notifications
        </h1>
        {total > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            {total} {total === 1 ? "notification" : "notifications"}
            {totalPages > 1 && (
              <span className="text-xs text-slate-600 ml-2">
                · Page {page} of {totalPages}
              </span>
            )}
          </p>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
            <Bell className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">All caught up!</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            You don&apos;t have any notifications yet. We&apos;ll let you know
            when something important happens.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  n.isRead
                    ? "bg-slate-900 border-slate-800"
                    : "bg-indigo-500/5 border-indigo-500/20"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 justify-between">
                      <p className="text-sm font-semibold text-white">
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{n.body}</p>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-2 font-semibold"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
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
                          ? "w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold"
                          : "w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                      }
                    >
                      {p}
                    </Link>
                  );
                }
                if (p === page - 2 || p === page + 2) {
                  return (
                    <span key={p} className="text-slate-700 text-xs">
                      …
                    </span>
                  );
                }
                return null;
              })}

              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
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