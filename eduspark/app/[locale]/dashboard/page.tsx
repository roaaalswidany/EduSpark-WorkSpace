import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  Award,
  Store,
  Package,
  Briefcase,
  ShieldCheck,
  Users,
  TrendingUp,
  Plus,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Hand,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("dashboard");
  const userId = session.user.id;
  const role = session.user.role as Role;

  const [
    enrollmentsCount,
    certificatesCount,
    servicesCount,
    projectsCount,
    ordersAsBuyer,
    totalUsers,
    totalCourses,
    totalServices,
    totalProjects,
  ] = await Promise.all([
    db.enrollment.count({ where: { userId } }),
    db.certificate.count({ where: { userId } }),
    db.service.count({ where: { creatorId: userId } }),
    db.project.count({
      where: { OR: [{ clientId: userId }, { creatorId: userId }] },
    }),
    db.order.count({ where: { buyerId: userId } }),
    role === "ADMIN" ? db.user.count() : Promise.resolve(0),
    role === "ADMIN" ? db.course.count() : Promise.resolve(0),
    role === "ADMIN" ? db.service.count() : Promise.resolve(0),
    role === "ADMIN" ? db.project.count() : Promise.resolve(0),
  ]);

  const isAdmin = role === "ADMIN";
  const isCreator = role === "CREATOR" || isAdmin;

  const roleKey = isAdmin ? "admin" : isCreator ? "creator" : "student";
  const subtitleKey = isAdmin
    ? "subtitles.admin"
    : isCreator
    ? "subtitles.creator"
    : "subtitles.student";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Welcome */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">
            {t(`roles.${roleKey}`)}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("welcome", {
            name: session.user.name?.split(" ")[0] ?? "there",
          })}{" "}
          <Hand className="inline-block w-8 h-8 text-amber-600 dark:text-amber-400 ml-2" />
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{t(subtitleKey)}</p>
      </div>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            {t("sections.platformOverview")}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label={t("stats.totalUsers")}
              value={totalUsers}
              icon={Users}
              color="text-primary"
              bg="bg-primary/10 border-primary/20"
            />
            <StatCard
              label={t("stats.courses")}
              value={totalCourses}
              icon={GraduationCap}
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10 border-amber-500/20"
            />
            <StatCard
              label={t("stats.services")}
              value={totalServices}
              icon={Store}
              color="text-emerald-600 dark:text-emerald-400"
              bg="bg-emerald-500/10 border-emerald-500/20"
            />
            <StatCard
              label={t("stats.projects")}
              value={totalProjects}
              icon={Briefcase}
              color="text-info"
              bg="bg-info/10 border-info/20"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/admin"
              className="group flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {t("adminPanel.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("adminPanel.description")}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/dashboard/chat"
              className="group flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-info" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {t("conversations.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("conversations.description")}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-info transition-colors" />
            </Link>
          </div>
        </div>
      )}

      {/* LEARNING */}
      <div className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          {t("sections.learning")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label={t("stats.myCourses")}
            value={enrollmentsCount}
            icon={BookOpen}
            color="text-primary"
            bg="bg-primary/10 border-primary/20"
            href="/dashboard/student/courses"
          />
          <StatCard
            label={t("stats.certificates")}
            value={certificatesCount}
            icon={Award}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-500/10 border-amber-500/20"
            href="/dashboard/student/certificates"
          />
          <StatCard
            label={t("stats.orders")}
            value={ordersAsBuyer}
            icon={Package}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-500/10 border-emerald-500/20"
            href="/marketplace"
          />
          <StatCard
            label={t("stats.projects")}
            value={projectsCount}
            icon={Briefcase}
            color="text-info"
            bg="bg-info/10 border-info/20"
            href="/dashboard/projects"
          />
        </div>
      </div>

      {/* CREATOR SECTION */}
      {isCreator && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("sections.creatorStudio")}
            </h2>
            <Link
              href="/dashboard/creator/services/new"
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                "text-xs font-bold transition-all active:scale-95",
                "shadow-lg shadow-emerald-500/20"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("creatorSection.newService")}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/creator/services"
              className="group flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {t("creatorSection.myServices")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("creatorSection.publishedCount", { count: servicesCount })}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/marketplace"
              className="group flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-emerald-500/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {t("creatorSection.marketplaceTitle")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("creatorSection.marketplaceDesc")}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            </Link>
          </div>
        </div>
      )}

      {/* EXPLORE */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          {t("sections.explore")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/courses"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-amber-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {t("explore.browseCourses")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("explore.browseCoursesDesc")}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
          </Link>

          <Link
            href="/marketplace"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {t("explore.browseServices")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("explore.browseServicesDesc")}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/70 group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 hover:border-border transition-all h-full">
      <div
        className={cn(
          "w-9 h-9 rounded-xl border flex items-center justify-center mb-3",
          bg
        )}
      >
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <p className="text-2xl font-black text-foreground tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-2">
        {label}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}