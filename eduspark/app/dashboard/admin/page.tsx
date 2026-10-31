/* eslint-disable react-hooks/purity */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, CourseStatus, ServiceStatus } from "@prisma/client";
import {
  Users, BookOpen, ShoppingBag, DollarSign, Bell,
  Clock, AlertCircle, Activity, ArrowRight,
  TrendingUp, ShieldAlert,
} from "lucide-react";
import { BroadcastForm } from "./_components/broadcast-form";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    redirect("/unauthorized");
  }

  const [
    totalUsers,
    totalCourses,
    totalServices,
    revenueSum,
    pendingCourses,
    pendingServices,
    recentLogs,
    newUsersThisWeek,
  ] = await Promise.all([
    db.user.count({ where: { isActive: true } }),
    db.course.count(),
    db.service.count(),
    db.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
    db.course.findMany({
      where: { status: CourseStatus.DRAFT },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        creator: { select: { name: true } },
      },
    }),
    db.service.findMany({
      where: { status: ServiceStatus.PAUSED },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        creator: { select: { name: true } },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        severity: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    db.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const revenue = revenueSum._sum.totalAmount
    ? Number(revenueSum._sum.totalAmount)
    : 0;
  const pendingTotal = pendingCourses.length + pendingServices.length;

  const stats = [
    {
      label: "Active Users",
      value: totalUsers,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      trend: newUsersThisWeek > 0 ? `+${newUsersThisWeek} this week` : null,
    },
    {
      label: "Total Courses",
      value: totalCourses,
      icon: BookOpen,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      trend: null,
    },
    {
      label: "Total Services",
      value: totalServices,
      icon: ShoppingBag,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      trend: null,
    },
    {
      label: "Revenue",
      value: `$${revenue.toFixed(0)}`,
      icon: DollarSign,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      trend: null,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Platform overview, pending reviews, and administrative controls.
        </p>
      </div>

      {/* Pending Alert */}
      {pendingTotal > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              {pendingTotal} item{pendingTotal > 1 ? "s" : ""} awaiting your review
            </p>
            <p className="text-xs text-amber-400/80 mt-1">
              {pendingCourses.length} draft course
              {pendingCourses.length !== 1 ? "s" : ""} ·{" "}
              {pendingServices.length} paused service
              {pendingServices.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}
                >
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {s.trend && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {s.trend}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-400">{s.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Pending Reviews + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Pending Reviews</h2>
            </div>
            <Link
              href="/dashboard/admin/courses?status=DRAFT"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {pendingCourses.length === 0 && pendingServices.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                All caught up! Nothing to review.
              </div>
            ) : (
              <>
                {pendingCourses.map((c) => (
                  <div
                    key={c.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{c.title}</p>
                      <p className="text-xs text-slate-500">
                        by {c.creator.name} · Draft course
                      </p>
                    </div>
                    <Link
                      href="/dashboard/admin/courses"
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold whitespace-nowrap"
                    >
                      Review
                    </Link>
                  </div>
                ))}
                {pendingServices.map((s) => (
                  <div
                    key={s.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{s.title}</p>
                      <p className="text-xs text-slate-500">
                        by {s.creator.name} · Paused service
                      </p>
                    </div>
                    <Link
                      href="/dashboard/admin/services"
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold whitespace-nowrap"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {recentLogs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                No activity yet. Actions will appear here.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      log.severity === "CRITICAL"
                        ? "bg-red-400"
                        : log.severity === "WARNING"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300">
                      <span className="font-semibold text-white">
                        {log.user?.name ?? "System"}
                      </span>{" "}
                      {log.action.replace(/\./g, " ")}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Broadcast + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Broadcast Notification
              </h2>
              <p className="text-xs text-slate-400">
                Send a message to all active users.
              </p>
            </div>
          </div>
          <BroadcastForm />
        </div>

        {/* Quick Actions */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Quick Actions</h2>
              <p className="text-xs text-slate-400">
                Jump to management sections.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/users"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">
                  Manage Users
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
            <Link
              href="/dashboard/admin/courses"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-slate-300">
                  Manage Courses
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
            <Link
              href="/dashboard/admin/services"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">
                  Manage Services
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}