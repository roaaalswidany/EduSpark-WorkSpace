/* eslint-disable @typescript-eslint/no-unused-vars */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { Users, BookOpen, ShoppingBag, DollarSign, Bell } from "lucide-react";
import { BroadcastForm } from "./_components/broadcast-form";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    redirect("/unauthorized");
  }

  // ── Fetch Analytics Data in Parallel ──────────────────────────────
  const [
    totalUsers,
    totalCourses,
    totalServices,
    totalEnrollments,
    ordersSum,
  ] = await Promise.all([
    db.user.count(),
    db.course.count(),
    db.service.count(),
    db.enrollment.count(),
    db.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalRevenue = ordersSum._sum.totalAmount ? Number(ordersSum._sum.totalAmount) : 0;

  const stats = [
    { label: "Total Users", value: totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Courses", value: totalCourses, icon: BookOpen, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Total Services", value: totalServices, icon: ShoppingBag, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Platform Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Platform overview, analytics, and administrative controls.
        </p>
      </div>

      {/* ── Analytics Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Broadcast Form ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Broadcast Notification</h2>
              <p className="text-xs text-slate-400">Send a message to all active users instantly.</p>
            </div>
          </div>
          <BroadcastForm />
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center">
            <Users className="w-12 h-12 text-slate-700 mb-3" />
            <h3 className="text-slate-300 font-semibold mb-1">Quick Actions</h3>
            <p className="text-sm text-slate-500 mb-4">Manage users, courses, and services.</p>
            <div className="flex flex-wrap justify-center gap-2">
    <a href="/dashboard/admin/users" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors">Manage Users</a>
    <a href="/dashboard/admin/courses" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors">Manage Courses</a>
    <a href="/dashboard/admin/services" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors">Manage Services</a>
        </div>
        </div>
      </div>
    </div>
  );
}