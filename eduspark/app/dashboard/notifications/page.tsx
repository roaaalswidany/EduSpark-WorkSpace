import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export const metadata = {
  title: "Notifications — EduSpark",
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
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
      )}
    </div>
  );
}