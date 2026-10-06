/* eslint-disable @typescript-eslint/no-unused-vars */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  Users,
  GraduationCap,
  Store,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Award,
  MessageSquare,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin Panel — EduSpark",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [
    totalUsers,
    activeUsers,
    creators,
    admins,
    totalCourses,
    publishedCourses,
    totalServices,
    activeServices,
    totalProjects,
    totalCertificates,
    totalEnrollments,
    recentUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { role: "CREATOR" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.service.count(),
    db.service.count({ where: { status: "ACTIVE" } }),
    db.project.count(),
    db.certificate.count(),
    db.enrollment.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Administrator</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Admin Panel
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Monitor and manage the entire EduSpark platform.
        </p>
      </div>

      {/* Platform Overview */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Platform Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Users"
            value={totalUsers}
            sub={`${activeUsers} active`}
            icon={Users}
            color="text-indigo-400"
            bg="bg-indigo-500/10 border-indigo-500/20"
          />
          <StatCard
            label="Courses"
            value={totalCourses}
            sub={`${publishedCourses} published`}
            icon={GraduationCap}
            color="text-amber-400"
            bg="bg-amber-500/10 border-amber-500/20"
          />
          <StatCard
            label="Services"
            value={totalServices}
            sub={`${activeServices} active`}
            icon={Store}
            color="text-emerald-400"
            bg="bg-emerald-500/10 border-emerald-500/20"
          />
          <StatCard
            label="Projects"
            value={totalProjects}
            sub="all time"
            icon={Briefcase}
            color="text-violet-400"
            bg="bg-violet-500/10 border-violet-500/20"
          />
        </div>
      </section>

      {/* Secondary Stats */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Engagement
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MiniStat label="Creators" value={creators} />
          <MiniStat label="Admins" value={admins} />
          <MiniStat label="Certificates Issued" value={totalCertificates} />
          <MiniStat label="Enrollments" value={totalEnrollments} />
        </div>
      </section>

      {/* Management */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ManageCard
            href="/dashboard/admin/users"
            title="Users"
            description="Manage accounts, roles, and access"
            icon={Users}
            color="indigo"
          />
          <ManageCard
            href="/dashboard/admin/courses"
            title="Courses"
            description="Review and manage all courses"
            icon={GraduationCap}
            color="amber"
          />
          <ManageCard
            href="/dashboard/admin/services"
            title="Services"
            description="Review and moderate marketplace"
            icon={Store}
            color="emerald"
          />
        </div>
      </section>

      {/* Recent Users */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Recent Sign-ups
          </h2>
          <Link
            href="/dashboard/admin/users"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          {recentUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No users yet
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {u.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {u.email}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      u.role === "ADMIN"
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : u.role === "CREATOR"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-700/50 text-slate-400 border-slate-700"
                    )}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5">
      <div
        className={cn(
          "w-9 h-9 rounded-xl border flex items-center justify-center mb-3",
          bg
        )}
      >
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <p className="text-2xl font-black text-white tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-2">
        {label}
      </p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3">
      <p className="text-lg font-bold text-white tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1.5">
        {label}
      </p>
    </div>
  );
}

const COLOR_MAP = {
  indigo: {
    bg: "bg-indigo-500/10 border-indigo-500/20",
    text: "text-indigo-400",
    hover: "hover:border-indigo-500/40",
  },
  amber: {
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-400",
    hover: "hover:border-amber-500/40",
  },
  emerald: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
    hover: "hover:border-emerald-500/40",
  },
};

function ManageCard({
  href,
  title,
  description,
  icon: Icon,
  color,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: keyof typeof COLOR_MAP;
}) {
  const c = COLOR_MAP[color];
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 transition-all",
        c.hover
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0",
          c.bg
        )}
      >
        <Icon className={cn("w-5 h-5", c.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors shrink-0" />
    </Link>
  );
}