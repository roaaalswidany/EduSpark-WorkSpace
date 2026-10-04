import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Store, Briefcase, ArrowRight } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { user } = session;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Welcome back, {user.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Role: <span className="text-indigo-400 font-medium">{user.role}</span>
        </p>
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/student/courses"
          className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">My Courses</h2>
          <p className="text-xs text-slate-500">
            Continue learning and track your progress
          </p>
          <div className="flex items-center gap-1 text-xs text-indigo-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          href="/marketplace"
          className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Store className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Marketplace</h2>
          <p className="text-xs text-slate-500">
            Browse services from certified creators
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>

        <Link
          href="/dashboard/projects"
          className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <Briefcase className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">My Projects</h2>
          <p className="text-xs text-slate-500">
            Manage your active orders and milestones
          </p>
          <div className="flex items-center gap-1 text-xs text-amber-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      {/* Placeholder for role-specific content */}
      {user.role === "CREATOR" && (
        <div className="mt-8 p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
          <h2 className="text-base font-bold text-white mb-2">
            Creator Tools
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Manage your services, view orders, and grow your business on EduSpark.
          </p>
          <Link
            href="/dashboard/creator/services/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Create new service
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}