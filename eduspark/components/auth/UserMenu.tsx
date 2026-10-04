"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, LayoutDashboard, User, ChevronDown } from "lucide-react";
import type { Session } from "next-auth";

export function UserMenu({ user }: { user: Session["user"] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
      >
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "User"}
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
            {initials}
          </div>
        )}
        <span className="hidden sm:block text-sm text-slate-300 max-w-30 truncate">
          {user?.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {user?.email}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <User className="w-4 h-4" />
              Profile
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-800 py-1">
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}