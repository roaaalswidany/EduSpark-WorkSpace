import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Inbox, ShieldAlert } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import {
  OrderCard,
  type OrderCardData,
} from "../../orders/_components/order-card";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "creatorOrders.page",
  });
  return { title: `${t("metadataTitle")} — EduSpark` };
}

export default async function CreatorOrdersPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("creatorOrders");
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect(`/${locale}/dashboard`);
  }

  const projects = await db.project.findMany({
    where: { creatorId: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: { id: true, name: true, image: true, headline: true },
      },
      service: {
        select: { title: true, thumbnail: true },
      },
      milestones: {
        select: { status: true },
      },
      chatRoom: {
        select: { id: true },
      },
    },
  });

  const orders: OrderCardData[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    budget: p.budget ? Number(p.budget) : null,
    deadline: p.deadline ? p.deadline.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    counterpart: p.client,
    service: p.service,
    milestoneStats: {
      total: p.milestones.length,
      completed: p.milestones.filter((m) => m.status === "APPROVED").length,
    },
    chatRoomId: p.chatRoom?.id ?? null,
  }));

  const newCount = orders.filter(
    (o) => o.status === "PENDING" || o.status === "OPEN"
  ).length;
  const activeCount = orders.filter(
    (o) => o.status === "IN_PROGRESS" || o.status === "REVIEW_REQUESTED"
  ).length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">
          <Inbox className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">
            {t("page.eyebrow")}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("page.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("page.subtitle")}
        </p>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-2xl font-black text-foreground tabular-nums leading-none">
              {newCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-2">
              {t("stats.new")}
            </p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-2xl font-black text-foreground tabular-nums leading-none">
              {activeCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-2">
              {t("stats.active")}
            </p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-2xl font-black text-foreground tabular-nums leading-none">
              {completedCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-2">
              {t("stats.completed")}
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Inbox className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("empty.title")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
            {t("empty.desc")}
          </p>
          <Link
            href="/dashboard/creator/services"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <ShieldAlert className="w-4 h-4" />
            {t("empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} isBuyer={false} />
          ))}
        </div>
      )}
    </div>
  );
}