"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  Store,
  LayoutDashboard,
  LogIn,
  Menu,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicNavbarProps {
  user: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

const NAV_LINKS = [
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/marketplace", label: "Marketplace", icon: Store },
] as const;

export function PublicNavbar({ user }: PublicNavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* التعديل هنا: flex justify-between للموبايل + md:grid للديسكتوب */}
        <div className="h-16 flex justify-between md:grid md:grid-cols-3 items-center gap-4 w-full">
          
          {/* العمود الأيسر: اللوجو */}
          <div className="flex justify-start">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-black text-white tracking-tight hidden sm:inline">
                EduSpark
              </span>
            </Link>
          </div>

          {/* العمود الأوسط: الروابط (للديسكتوب فقط) */}
          <nav className="hidden md:flex justify-center items-center gap-2">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* العمود الأيمن: الأزرار */}
          <div className="flex justify-end items-center gap-3">
            {/* أزرار الديسكتوب */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg",
                    "bg-indigo-600 hover:bg-indigo-500 text-white",
                    "text-sm font-bold transition-all active:scale-95",
                    "shadow-lg shadow-indigo-500/20"
                  )}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg",
                      "text-slate-300 hover:text-white hover:bg-slate-800",
                      "text-sm font-semibold transition-all"
                    )}
                  >
                    Sign In
                  </Link>

                  <Link
                    href="/auth/register"
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-lg",
                      "bg-indigo-600 hover:bg-indigo-500 text-white",
                      "text-sm font-bold transition-all active:scale-95",
                      "shadow-lg shadow-indigo-500/20"
                    )}
                  >
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>

            {/* زر الموبايل — هلق رح يطلع على الطرف اليمين */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden py-4 border-t border-slate-800 space-y-2 animate-slide-down origin-top">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-semibold transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-4 mt-2 border-t border-slate-800 space-y-3">
              {user ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}