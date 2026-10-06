/* eslint-disable @typescript-eslint/no-unused-vars */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Inbox, Search, ShieldAlert } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import {
  OrderCard,
  type OrderCardData,
} from "../../orders/_components/order-card";

export const metadata = {
  title: "Incoming Orders — EduSpark",
};

export default async function CreatorOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== Role.CREATOR && role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  // Incoming orders = Projects where I'm the CREATOR (seller)
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
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
          <Inbox className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Creator Studio</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Incoming Orders
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Manage orders from your clients.
        </p>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-2xl font-black text-white tabular-nums leading-none">
              {newCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-2">
              New
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-2xl font-black text-white tabular-nums leading-none">
              {activeCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-2">
              In Progress
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-2xl font-black text-white tabular-nums leading-none">
              {completedCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-2">
              Completed
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Inbox className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            No incoming orders
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            When clients order your services, their orders will appear here.
          </p>
          <Link
            href="/dashboard/creator/services"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <ShieldAlert className="w-4 h-4" />
            View My Services
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