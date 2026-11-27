"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogOut, LayoutDashboard, User, ChevronDown } from "lucide-react";
import type { Session } from "next-auth";

export function UserMenu({ user }: { user: Session["user"] }) {
  const t = useTranslations("userMenu");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {initials}
        </div>
        <span className="hidden sm:block text-sm text-foreground max-w-30 truncate">
          {user?.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {user?.email}
            </p>
          </div>

          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              {t("dashboard")}
            </Link>
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <User className="w-4 h-4" />
              {t("profile")}
            </Link>
          </div>

          <div className="border-t border-border py-1">
            <button
              onClick={() => signOut({ callbackUrl: `/${locale}/auth/login` })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4 rtl:rotate-180" />
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}