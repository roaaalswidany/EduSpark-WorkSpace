/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Briefcase, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects.page" });
  return { title: `${t("title")} — EduSpark` };
}

const STATUS_KEY_MAP: Record<string, string> = {
  PENDING: "pending",
  OPEN: "open",
  IN_PROGRESS: "inProgress",
  REVIEW_REQUESTED: "reviewRequested",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DISPUTED: "disputed",
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("projects.page");
  const tStatus = await getTranslations("projects.statuses");
  const userId = session.user.id;

  const projects = await db.project.findMany({
    where: {
      OR: [{ clientId: userId }, { creatorId: userId }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      deadline: true,
      clientId: true,
      creatorId: true,
      client: { select: { name: true, image: true } },
      creator: { select: { name: true, image: true } },
      _count: { select: { milestones: true } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-info mb-2">
          <Briefcase className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t("workspace")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {projects.length === 0
            ? t("noProjects")
            : t("projectsCount", { count: projects.length })}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center mx-auto mb-5">
            <Briefcase className="w-7 h-7 text-info" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("emptyTitle")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
            {t("emptyDesc")}
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <Search className="w-4 h-4" />
            {t("browseServices")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const isClient = p.clientId === userId;
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-info/40 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-info" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isClient ? t("clientLabel") : t("creatorLabel")} ·{" "}
                    {t("milestonesCount", { count: p._count.milestones })}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-accent text-muted-foreground border border-border shrink-0">
                  {tStatus(STATUS_KEY_MAP[p.status] as any)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}