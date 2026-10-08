import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { UsersTable } from "./_components/users-table";

export const metadata = {
  title: "Users — Admin — EduSpark",
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    ...(sp.q && {
      OR: [
        { name: { contains: sp.q, mode: "insensitive" as const } },
        { email: { contains: sp.q, mode: "insensitive" as const } },
      ],
    }),
    ...(sp.role && {
      role: sp.role as "STUDENT" | "CREATOR" | "ADMIN",
    }),
  };

  // ── Fetch paginated users + total + role counts in parallel ────
  const [users, total, totals] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            services: true,
          },
        },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
  ]);

  const roleCounts = {
    STUDENT: totals.find((t) => t.role === "STUDENT")?._count._all ?? 0,
    CREATOR: totals.find((t) => t.role === "CREATOR")?._count._all ?? 0,
    ADMIN: totals.find((t) => t.role === "ADMIN")?._count._all ?? 0,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <Users className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Admin</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Users
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Manage roles, activate or suspend accounts.
        </p>
      </div>

      <UsersTable
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
        roleCounts={roleCounts}
        initialQuery={sp.q ?? ""}
        initialRole={sp.role ?? ""}
        total={total}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}