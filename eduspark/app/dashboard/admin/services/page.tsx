import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Store } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServicesTable } from "./_components/services-table";

export const metadata = {
  title: "Services — Admin — EduSpark",
};

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AdminServicesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;

  const services = await db.service.findMany({
    where: {
      ...(sp.q && {
        OR: [
          { title: { contains: sp.q, mode: "insensitive" } },
          { description: { contains: sp.q, mode: "insensitive" } },
        ],
      }),
      ...(sp.status && {
        status: sp.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      thumbnail: true,
      status: true,
      price: true,
      deliveryDays: true,
      createdAt: true,
      creator: {
        select: { id: true, name: true, image: true },
      },
      category: {
        select: { id: true, name: true },
      },
      _count: {
        select: { orders: true, projects: true },
      },
    },
  });

  const statusCounts = await db.service.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = {
    ACTIVE: statusCounts.find((s) => s.status === "ACTIVE")?._count._all ?? 0,
    PAUSED: statusCounts.find((s) => s.status === "PAUSED")?._count._all ?? 0,
    ARCHIVED:
      statusCounts.find((s) => s.status === "ARCHIVED")?._count._all ?? 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
          <Store className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Admin</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Services
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Moderate and review all marketplace services.
        </p>
      </div>

      <ServicesTable
        services={services.map((s) => ({
          ...s,
          price: Number(s.price),
          createdAt: s.createdAt.toISOString(),
        }))}
        statusCounts={counts}
        initialQuery={sp.q ?? ""}
        initialStatus={sp.status ?? ""}
      />
    </div>
  );
}