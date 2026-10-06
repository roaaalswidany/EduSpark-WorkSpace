import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { UsersTable } from "./_components/users-table";

export const metadata = {
  title: "Users — Admin — EduSpark",
};

interface PageProps {
  searchParams: Promise<{ q?: string; role?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;

  const users = await db.user.findMany({
    where: {
      ...(sp.q && {
        OR: [
          { name: { contains: sp.q, mode: "insensitive" } },
          { email: { contains: sp.q, mode: "insensitive" } },
        ],
      }),
      ...(sp.role && { role: sp.role as "STUDENT" | "CREATOR" | "ADMIN" }),
    },
    orderBy: { createdAt: "desc" },
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
  });

  const totals = await db.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });

  const roleCounts = {
    STUDENT: totals.find((t) => t.role === "STUDENT")?._count._all ?? 0,
    CREATOR: totals.find((t) => t.role === "CREATOR")?._count._all ?? 0,
    ADMIN: totals.find((t) => t.role === "ADMIN")?._count._all ?? 0,
  };

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
      />
    </div>
  );
}