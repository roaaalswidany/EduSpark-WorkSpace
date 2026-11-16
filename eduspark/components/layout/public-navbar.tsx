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
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Layout: mobile flex justify-between + desktop md:grid */}
        <div className="h-16 flex justify-between md:grid md:grid-cols-3 items-center gap-4 w-full">
          {/* Left column: Logo */}
          <div className="flex justify-start">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 text-foreground" />
              </div>
              <span className="text-base font-black text-foreground tracking-tight hidden sm:inline">
                EduSpark
              </span>
            </Link>
          </div>

          {/* Middle column: Links (desktop only) */}
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
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right column: Buttons */}
          <div className="flex justify-end items-center gap-3">
            {/* Desktop buttons */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg",
                    "bg-primary hover:bg-primary/90 text-primary-foreground",
                    "text-sm font-bold transition-all active:scale-95",
                    "shadow-lg shadow-emerald-500/20"
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
                      "text-foreground hover:bg-accent",
                      "text-sm font-semibold transition-all"
                    )}
                  >
                    Sign In
                  </Link>

                  <Link
                    href="/auth/register"
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-lg",
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                      "text-sm font-bold transition-all active:scale-95",
                      "shadow-lg shadow-emerald-500/20"
                    )}
                  >
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu toggle — appears on the right edge */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
          <nav className="md:hidden py-4 border-t border-border space-y-2 animate-slide-down origin-top">
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
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-semibold transition-all border",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-4 mt-2 border-t border-border space-y-3">
              {user ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-semibold text-foreground bg-accent hover:bg-accent/80 transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
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