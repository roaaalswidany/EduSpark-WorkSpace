import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ShoppingBag, Search } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { OrderCard, type OrderCardData } from "./_components/order-card";

export const metadata = {
  title: "My Orders — EduSpark",
};

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  // Orders = Projects where I'm the CLIENT (buyer)
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
    counterpart: p.creator ?? {
      id: "",
      name: "Unassigned",
      image: null,
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
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Buying</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          My Orders
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {orders.length === 0
            ? "No orders yet. Order a service to get started."
            : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            No orders yet
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            Browse the marketplace and hire a certified creator to see your
            orders here.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <Search className="w-4 h-4" />
            Browse Marketplace
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