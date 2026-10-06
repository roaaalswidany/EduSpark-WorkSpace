/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, Bell, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { DashboardSidebar } from "./dashboard-sidebar";

interface DashboardShellProps {
  role: Role;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  unreadNotifications: number;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  user,
  unreadNotifications,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ─── Desktop sidebar ─────────────────────────────── */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex">
        <DashboardSidebar role={role} user={user} />
      </div>

      {/* ─── Mobile drawer ───────────────────────────────── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute top-3 -right-10 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
              <DashboardSidebar
                role={role}
                user={user}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        </>
      )}

      {/* ─── Main content area ───────────────────────────── */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 sm:px-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-4 h-4 text-slate-400" />
          </button>

          {/* Breadcrumb-ish title */}
          <h1 className="flex-1 min-w-0 text-sm font-semibold text-slate-300 truncate">
            {getPageTitle(pathname)}
          </h1>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/notifications"
              className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-400" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}

// ─── Page title helper ────────────────────────────────────

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/chat")) return "Messages";
  if (pathname === "/dashboard/profile") return "Profile";
  if (pathname === "/dashboard/notifications") return "Notifications";
  if (pathname.startsWith("/dashboard/student/courses/")) return "Course";
  if (pathname === "/dashboard/student/courses") return "My Courses";
  if (pathname === "/dashboard/student/certificates") return "Certificates";
  if (pathname === "/dashboard/creator/services/new") return "New Service";
  if (pathname.includes("/edit")) return "Edit Service";
  if (pathname === "/dashboard/creator/services") return "My Services";
  if (pathname === "/dashboard/projects") return "Projects";
  if (pathname.startsWith("/dashboard/projects/")) return "Project";
  if (pathname === "/dashboard/admin") return "Admin Panel";
  return "Dashboard";
}