import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShoppingBag, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { OrderCard, type OrderCardData } from "./_components/order-card";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders.page" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("orders.page");
  const userId = session.user.id;

  const projects = await db.project.findMany({
    where: { clientId: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      budget: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
      creator: {
        select: { id: true, name: true, headline: true },
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
    counterpart: p.creator ?? {
      id: "",
      name: "",
      headline: null,
    },
    service: p.service,
    milestoneStats: {
      total: p.milestones.length,
      completed: p.milestones.filter((m) => m.status === "APPROVED").length,
    },
    chatRoomId: p.chatRoom?.id ?? null,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t("buying")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {orders.length === 0
            ? t("noOrders")
            : t("ordersCount", { count: orders.length })}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-7 h-7 text-primary" />
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
            {t("browseMarketplace")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} isBuyer={true} />
          ))}
        </div>
      )}
    </div>
  );
}