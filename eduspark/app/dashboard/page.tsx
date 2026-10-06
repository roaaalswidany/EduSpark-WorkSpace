import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

export const metadata = {
  title: "Dashboard — EduSpark",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;
  const role = session.user.role as Role;

  // Fetch stats in parallel
  const [
    enrollmentsCount,
    certificatesCount,
    servicesCount,
    projectsCount,
    ordersAsBuyer,
    // Admin-only
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
    // Admin stats (cheap enough to always compute; harmless for non-admins)
    role === "ADMIN" ? db.user.count() : Promise.resolve(0),
    role === "ADMIN" ? db.course.count() : Promise.resolve(0),
    role === "ADMIN" ? db.service.count() : Promise.resolve(0),
    role === "ADMIN" ? db.project.count() : Promise.resolve(0),
  ]);

  const isAdmin = role === "ADMIN";
  const isCreator = role === "CREATOR" || isAdmin;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Welcome */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">
            {isAdmin ? "Administrator" : isCreator ? "Creator" : "Student"}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Welcome back, {session.user.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {isAdmin
            ? "Monitor and manage the entire EduSpark platform."
            : isCreator
            ? "Grow your business, manage services, and track your orders."
            : "Continue learning, earn certificates, and unlock your potential."}
        </p>
      </div>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Total Users"
              value={totalUsers}
              icon={Users}
              color="text-indigo-400"
              bg="bg-indigo-500/10 border-indigo-500/20"
            />
            <StatCard
              label="Courses"
              value={totalCourses}
              icon={GraduationCap}
              color="text-amber-400"
              bg="bg-amber-500/10 border-amber-500/20"
            />
            <StatCard
              label="Services"
              value={totalServices}
              icon={Store}
              color="text-emerald-400"
              bg="bg-emerald-500/10 border-emerald-500/20"
            />
            <StatCard
              label="Projects"
              value={totalProjects}
              icon={Briefcase}
              color="text-violet-400"
              bg="bg-violet-500/10 border-violet-500/20"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/admin"
              className="group flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Admin Panel</p>
                <p className="text-xs text-slate-500">
                  Manage users, courses, and services
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/chat"
              className="group flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Conversations</p>
                <p className="text-xs text-slate-500">
                  Monitor platform-wide chats
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
            </Link>
          </div>
        </div>
      )}

      {/* LEARNING (Student + Creator + Admin) */}
      <div className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Learning
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="My Courses"
            value={enrollmentsCount}
            icon={BookOpen}
            color="text-indigo-400"
            bg="bg-indigo-500/10 border-indigo-500/20"
            href="/dashboard/student/courses"
          />
          <StatCard
            label="Certificates"
            value={certificatesCount}
            icon={Award}
            color="text-amber-400"
            bg="bg-amber-500/10 border-amber-500/20"
            href="/dashboard/student/certificates"
          />
          <StatCard
            label="Orders"
            value={ordersAsBuyer}
            icon={Package}
            color="text-emerald-400"
            bg="bg-emerald-500/10 border-emerald-500/20"
            href="/marketplace"
          />
          <StatCard
            label="Projects"
            value={projectsCount}
            icon={Briefcase}
            color="text-violet-400"
            bg="bg-violet-500/10 border-violet-500/20"
            href="/dashboard/projects"
          />
        </div>
      </div>

      {/* CREATOR SECTION */}
      {isCreator && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Creator Studio
            </h2>
            <Link
              href="/dashboard/creator/services/new"
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "bg-indigo-600 hover:bg-indigo-500 text-white",
                "text-xs font-bold transition-all active:scale-95",
                "shadow-lg shadow-indigo-500/20"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              New Service
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/creator/services"
              className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">My Services</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {servicesCount} {servicesCount === 1 ? "service" : "services"} published
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </Link>

            <Link
              href="/marketplace"
              className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Marketplace</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse what other creators offer
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </Link>
          </div>
        </div>
      )}

      {/* EXPLORE */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Explore
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/courses"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Browse Courses</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Discover new skills to master
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
          </Link>

          <Link
            href="/marketplace"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Browse Services</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Hire certified experts
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
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
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 hover:border-slate-700 transition-all h-full">
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