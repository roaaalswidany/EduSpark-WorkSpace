/* eslint-disable react-hooks/purity */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, CourseStatus, ServiceStatus } from "@prisma/client";
import {
  Users, BookOpen, ShoppingBag, DollarSign, Bell,
  Clock, AlertCircle, Activity, ArrowRight,
  TrendingUp, ShieldAlert,
} from "lucide-react";
import { BroadcastForm } from "./_components/broadcast-form";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "admin.dashboard",
  });
  return { title: `${t("metadataTitle")} — EduSpark` };
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    redirect(`/${locale}/unauthorized`);
  }

  const t = await getTranslations("admin.dashboard");

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
      where: { status: CourseStatus.PENDING_REVIEW },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        creator: { select: { name: true } },
      },
    }),
    db.service.findMany({
      where: { status: ServiceStatus.PENDING_REVIEW },
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
      label: t("stats.activeUsers"),
      value: totalUsers,
      icon: Users,
      color: "text-info",
      bg: "bg-info/10",
      trend:
        newUsersThisWeek > 0
          ? t("stats.newThisWeek", { count: newUsersThisWeek })
          : null,
    },
    {
      label: t("stats.totalCourses"),
      value: totalCourses,
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10",
      trend: null,
    },
    {
      label: t("stats.totalServices"),
      value: totalServices,
      icon: ShoppingBag,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      trend: null,
    },
    {
      label: t("stats.revenue"),
      value: `$${revenue.toFixed(0)}`,
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      trend: null,
    },
  ];

  const dateLocale = locale === "ar" ? "ar" : "en-US";

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Pending Alert */}
      {pendingTotal > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("pendingAlert.title", { count: pendingTotal })}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
              {t("pendingAlert.details", {
                courses: pendingCourses.length,
                services: pendingServices.length,
              })}
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
              className="p-5 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}
                >
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {s.trend && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {s.trend}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {s.label}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pending Reviews + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-foreground">
                {t("sections.pendingReviews")}
              </h2>
            </div>
            <Link
              href="/dashboard/admin/courses?status=DRAFT"
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {t("sections.viewAll")} →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {pendingCourses.length === 0 && pendingServices.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t("pendingEmpty")}
              </div>
            ) : (
              <>
                {pendingCourses.map((c) => (
                  <div
                    key={c.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("byCreator")} {c.creator.name} ·{" "}
                        {t("draftCourse")}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/admin/courses"
                      className="text-xs text-primary hover:text-primary/80 font-semibold whitespace-nowrap"
                    >
                      {t("review")}
                    </Link>
                  </div>
                ))}
                {pendingServices.map((s) => (
                  <div
                    key={s.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {s.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("byCreator")} {s.creator.name} ·{" "}
                        {t("pausedService")}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/admin/services"
                      className="text-xs text-primary hover:text-primary/80 font-semibold whitespace-nowrap"
                    >
                      {t("review")}
                    </Link>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {t("sections.recentActivity")}
            </h2>
          </div>
          <div className="divide-y divide-border">
            {recentLogs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t("activityEmpty")}
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      log.severity === "CRITICAL"
                        ? "bg-destructive"
                        : log.severity === "WARNING"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold text-foreground">
                        {log.user?.name ?? t("system")}
                      </span>{" "}
                      {log.action.replace(/\./g, " ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(log.createdAt).toLocaleString(dateLocale, {
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
        <div className="p-6 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("sections.broadcast")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("sections.broadcastDesc")}
              </p>
            </div>
          </div>
          <BroadcastForm />
        </div>

        {/* Quick Actions */}
        <div className="p-6 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-info" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("sections.quickActions")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("sections.quickActionsDesc")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/users"
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/40 hover:bg-background transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-info" />
                <span className="text-sm font-medium text-foreground">
                  {t("actions.manageUsers")}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-muted-foreground group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 transition-all" />
            </Link>
            <Link
              href="/dashboard/admin/courses"
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/40 hover:bg-background transition-colors group"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {t("actions.manageCourses")}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-muted-foreground group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 transition-all" />
            </Link>
            <Link
              href="/dashboard/admin/services"
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/40 hover:bg-background transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-foreground">
                  {t("actions.manageServices")}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-muted-foreground group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}