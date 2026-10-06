/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  X,
  CheckCircle2,
  XCircle,
  Shield,
  Loader2,
  AlertCircle,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { updateUserAction } from "@/actions/admin/update-user";

interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  _count: {
    enrollments: number;
    certificates: number;
    services: number;
  };
}

interface UsersTableProps {
  users: UserRow[];
  currentUserId: string;
  roleCounts: {
    STUDENT: number;
    CREATOR: number;
    ADMIN: number;
  };
  initialQuery: string;
  initialRole: string;
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  CREATOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  STUDENT: "bg-slate-700/50 text-slate-400 border-slate-700",
};

const ROLE_FILTERS: { value: string; label: string; count: number }[] = [
  { value: "", label: "All", count: 0 },
  { value: "STUDENT", label: "Students", count: 0 },
  { value: "CREATOR", label: "Creators", count: 0 },
  { value: "ADMIN", label: "Admins", count: 0 },
];

function Avatar({
  name,
  image,
  size = 36,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-xl object-cover ring-2 ring-slate-800 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-xl flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-800 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue}, 55%, 42%)`,
      }}
    >
      {initials}
    </div>
  );
}

export function UsersTable({
  users,
  currentUserId,
  roleCounts,
  initialQuery,
  initialRole,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const activeRole = searchParams.get("role") ?? "";

  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    const timer = setTimeout(() => {
      updateURL({ q: value });
    }, 350);
    return () => clearTimeout(timer);
  };

  const handleRoleFilter = (role: string) => {
    updateURL({ role });
  };

  const handleToggleActive = (user: UserRow) => {
    setOpenMenuId(null);
    setActionError(null);
    setPendingUserId(user.id);

    startTransition(async () => {
      const result = await updateUserAction({
        userId: user.id,
        action: "TOGGLE_ACTIVE",
      });
      setPendingUserId(null);

      if (!result.success) {
        const messages: Record<string, string> = {
          CANNOT_MODIFY_SELF: "You cannot deactivate your own account.",
          FORBIDDEN: "Only admins can perform this action.",
          NOT_FOUND: "User not found.",
        };
        setActionError(messages[result.error] ?? "Action failed.");
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      router.refresh();
    });
  };

  const handleChangeRole = (user: UserRow, role: Role) => {
    setOpenMenuId(null);
    setActionError(null);
    setPendingUserId(user.id);

    startTransition(async () => {
      const result = await updateUserAction({
        userId: user.id,
        action: "CHANGE_ROLE",
        role,
      });
      setPendingUserId(null);

      if (!result.success) {
        const messages: Record<string, string> = {
          CANNOT_MODIFY_SELF: "You cannot change your own role.",
          FORBIDDEN: "Only admins can perform this action.",
          NOT_FOUND: "User not found.",
        };
        setActionError(messages[result.error] ?? "Action failed.");
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      router.refresh();
    });
  };

  const filters = ROLE_FILTERS.map((f) =>
    f.value === ""
      ? {
          ...f,
          count: roleCounts.STUDENT + roleCounts.CREATOR + roleCounts.ADMIN,
        }
      : {
          ...f,
          count: roleCounts[f.value as "STUDENT" | "CREATOR" | "ADMIN"],
        }
  );

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email…"
            className={cn(
              "w-full h-11 pl-10 pr-10 rounded-xl",
              "bg-slate-900 border border-slate-800 text-slate-200",
              "placeholder:text-slate-600",
              "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            )}
          />
          {isPending && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          )}
          {!isPending && searchInput && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {filters.map((f) => {
            const active = activeRole === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleRoleFilter(f.value)}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
                  active
                    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
                )}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{actionError}</p>
        </div>
      )}

      {/* Table */}
      {users.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5">
            <Search className="w-7 h-7 text-slate-600" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">No users found</h2>
          <p className="text-sm text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-visible">
          {/* Desktop header */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-800 bg-slate-900/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              User
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Role
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Activity
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Status
            </span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-slate-800">
            {users.map((u, idx) => {
              const isSelf = u.id === currentUserId;
              const isPendingUser = pendingUserId === u.id;
              const isLastRow = idx === users.length - 1;

              return (
                <div
                  key={u.id}
                  className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-slate-800/40 transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.name} image={u.image} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-[10px] font-bold text-indigo-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Role:
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        ROLE_BADGE[u.role]
                      )}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {u.role}
                    </span>
                  </div>

                  {/* Activity */}
                  <div className="flex lg:block gap-3 text-xs text-slate-500">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Activity:
                    </span>
                    <span className="whitespace-nowrap">
                      {u._count.enrollments} courses ·{" "}
                      {u._count.certificates} certificates ·{" "}
                      {u._count.services} services
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Status:
                    </span>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400 font-semibold">
                        <XCircle className="w-3.5 h-3.5" />
                        Suspended
                      </span>
                    )}
                  </div>

                  {/* Menu */}
                  <div className="relative lg:justify-self-end">
                    {isPendingUser ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === u.id ? null : u.id)
                        }
                        disabled={isSelf}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="User actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}

                    {openMenuId === u.id && !isSelf && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div
                          className={cn(
                            "absolute right-0 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 overflow-hidden z-20",
                            isLastRow ? "bottom-full mb-1" : "top-full mt-1"
                          )}
                        >
                          <div className="px-3 py-2 border-b border-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                              Change role
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "STUDENT")}
                            disabled={u.role === "STUDENT"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Student
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "CREATOR")}
                            disabled={u.role === "CREATOR"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Creator
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "ADMIN")}
                            disabled={u.role === "ADMIN"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Admin
                          </button>
                          <div className="h-px bg-slate-800" />
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            className={cn(
                              "w-full text-left px-3.5 py-2 text-xs transition-colors",
                              u.isActive
                                ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                : "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                            )}
                          >
                            {u.isActive ? "Suspend account" : "Activate account"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}