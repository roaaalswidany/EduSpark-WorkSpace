/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
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
  total: number;
  currentPage: number;
  totalPages: number;
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-info/10 text-info border-info/20",
  CREATOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  STUDENT: "bg-accent/50 text-muted-foreground border-border",
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin ًں‘‘",
  CREATOR: "Creator âœ¨",
  STUDENT: "Student ًںژ“",
};

const ROLE_FILTERS: { value: string; label: string; count: number }[] = [
  { value: "", label: "All", count: 0 },
  { value: "STUDENT", label: "Students", count: 0 },
  { value: "CREATOR", label: "Creators", count: 0 },
  { value: "ADMIN", label: "Admins", count: 0 },
];

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

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
  total,
  currentPage,
  totalPages,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  // Proper debounce using useRef to avoid memory leaks
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const activeRole = searchParams.get("role") ?? "";

  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      // Reset to page 1 when changing filters/search
      if (!("page" in updates)) params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const buildPageUrl = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (targetPage > 1) params.set("page", String(targetPage));
      else params.delete("page");
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      updateURL({ q: value });
    }, 350);
  };

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRoleFilter = (role: string) => {
    updateURL({ role });
  };

  // Low-level executor â€” runs the actual action and shows toasts.
  const executeToggle = (user: UserRow, reason?: string) => {
    setPendingUserId(user.id);

    const isSuspending = user.isActive;
    const toastId = toast.loading(
      isSuspending ? "Suspending accountâ€¦" : "Activating accountâ€¦"
    );

    startTransition(async () => {
      const result = await updateUserAction({
        userId: user.id,
        action: "TOGGLE_ACTIVE",
        reason,
      });
      setPendingUserId(null);

      if (!result.success) {
        const messages: Record<string, string> = {
          CANNOT_MODIFY_SELF: "You cannot deactivate your own account.",
          FORBIDDEN: "Only admins can perform this action.",
          NOT_FOUND: "User not found.",
          INVALID_INPUT: "A valid reason is required to suspend an account.",
        };
        const errorMessage = messages[result.error] ?? "Action failed.";

        setActionError(errorMessage);
        toast.error("Action failed", {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      toast.success(
        isSuspending ? "Account suspended" : "Account activated",
        {
          id: toastId,
          description: `${user.name}'s account has been ${
            isSuspending ? "suspended" : "reactivated"
          }.`,
        }
      );
      router.refresh();
    });
  };

  // User-facing handler â€” opens the reason dialog when suspending.
  const handleToggleActive = (user: UserRow) => {
    setOpenMenuId(null);
    setActionError(null);

    // Reactivation â€” no reason needed, execute immediately.
    if (!user.isActive) {
      executeToggle(user, undefined);
      return;
    }

    // Suspension â€” require a reason first.
    setSuspendDialog({ userId: user.id, userName: user.name });
    setReasonInput("");
    setReasonError(null);
  };

  // Dialog submit â€” validates the reason, then executes.
  const handleConfirmSuspend = () => {
    if (!suspendDialog) return;

    const trimmed = reasonInput.trim();
    if (trimmed.length < 10) {
      setReasonError(
        "Please provide at least 10 characters explaining the reason."
      );
      return;
    }

    const target = users.find((u) => u.id === suspendDialog.userId);
    if (!target) return;

    executeToggle(target, trimmed);
    setSuspendDialog(null);
    setReasonInput("");
    setReasonError(null);
  };

  const handleChangeRole = (user: UserRow, role: Role) => {
    setOpenMenuId(null);
    setActionError(null);
    setPendingUserId(user.id);

    const toastId = toast.loading(`Updating role to ${role}â€¦`);

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
        const errorMessage = messages[result.error] ?? "Action failed.";

        setActionError(errorMessage);
        toast.error("Role update failed", {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      toast.success(`Role updated to ${ROLE_LABEL[role]}`, {
        id: toastId,
        description: `${user.name}'s role has been changed.`,
      });
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or emailâ€¦"
            className={cn(
              "w-full h-11 pl-10 pr-10 rounded-xl",
              "bg-card border border-border text-foreground",
              "placeholder:text-muted-foreground/70",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-indigo-500"
            )}
          />
          {isPending && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          )}
          {!isPending && searchInput && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
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
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground"
                )}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {users.length > 0 ? (currentPage - 1) * 20 + 1 : 0}â€“
          {Math.min(currentPage * 20, total)} of {total}
          {totalPages > 1 && (
            <span className="text-muted-foreground/70 ml-2">
              آ· Page {currentPage} of {totalPages}
            </span>
          )}
        </p>
      )}

      {/* Action Error */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      {/* Table */}
      {users.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center mx-auto mb-5">
            <Search className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">No users found</h2>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-visible">
          {/* Desktop header */}
          <div className="hidden lg:grid grid-cols-[1.5fr_0.8fr_1.7fr_0.6fr_auto] gap-4 px-5 py-3 border-b border-border bg-card/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              User
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Role
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Activity
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                  className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr_1.7fr_0.6fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-accent/40 transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0 pr-12 lg:pr-0">
                    <Avatar name={u.name} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                        {u.name}
                        {isSelf && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex lg:block min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">
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
                  <div className="flex lg:block gap-3 text-xs text-muted-foreground min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center shrink-0">
                      Activity:
                    </span>
                    <span className="truncate">
                      {u._count.enrollments} courses آ·{" "}
                      {u._count.certificates} certificates آ·{" "}
                      {u._count.services} services
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex lg:block min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center shrink-0">
                      Status:
                    </span>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold whitespace-nowrap">
                        <XCircle className="w-3.5 h-3.5" />
                        Suspended
                      </span>
                    )}
                  </div>

                  {/* Menu */}
                  <div className="absolute top-4 right-4 lg:static lg:justify-self-end">
                    {isPendingUser ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === u.id ? null : u.id)
                        }
                        disabled={isSelf}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                            "absolute right-0 w-52 rounded-xl bg-card border border-border shadow-2xl shadow-black/60 overflow-hidden z-20",
                            "animate-slide-down",
                            isLastRow
                              ? "bottom-full mb-1 origin-bottom-right"
                              : "top-full mt-1 origin-top-right"
                          )}
                        >
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                              Change role
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "STUDENT")}
                            disabled={u.role === "STUDENT"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Student
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "CREATOR")}
                            disabled={u.role === "CREATOR"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Creator
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "ADMIN")}
                            disabled={u.role === "ADMIN"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Make Admin
                          </button>
                          <div className="h-px bg-accent" />
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            className={cn(
                              "w-full text-left px-3.5 py-2 text-xs transition-colors",
                              u.isActive
                                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors"
            >
              â†گ Previous
            </Link>
          )}

          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            if (
              p === 1 ||
              p === totalPages ||
              (p >= currentPage - 1 && p <= currentPage + 1)
            ) {
              return (
                <Link
                  key={p}
                  href={buildPageUrl(p)}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                    p === currentPage
                      ? "bg-primary text-white font-bold"
                      : "bg-card border border-border hover:border-border text-muted-foreground hover:text-white"
                  )}
                >
                  {p}
                </Link>
              );
            }
            if (p === currentPage - 2 || p === currentPage + 2) {
              return (
                <span key={p} className="text-muted-foreground/70 text-xs">
                  â€¦
                </span>
              );
            }
            return null;
          })}

          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors"
            >
              Next â†’
            </Link>
          )}
        </div>
      )}
            {/* Suspend reason dialog */}
      {suspendDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setSuspendDialog(null);
              setReasonInput("");
              setReasonError(null);
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4 pointer-events-auto">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <h3 className="text-lg font-bold text-white">
                    Suspend account
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please provide a reason for suspending{" "}
                  <strong className="text-foreground">
                    {suspendDialog.userName}
                  </strong>
                  . This reason will be sent to the user by email.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Reason (required)
                </label>
                <textarea
                  value={reasonInput}
                  onChange={(e) => {
                    setReasonInput(e.target.value);
                    setReasonError(null);
                  }}
                  rows={4}
                  autoFocus
                  maxLength={500}
                  className={cn(
                    "w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground resize-none",
                    "focus:outline-none",
                    reasonError
                      ? "border-destructive"
                      : "border-border focus:border-primary"
                  )}
                  placeholder="e.g., Violation of platform terms of service."
                />
                {reasonError && (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {reasonError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  {reasonInput.trim().length}/500 characters (minimum 10)
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuspendDialog(null);
                    setReasonInput("");
                    setReasonError(null);
                  }}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent text-foreground text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSuspend}
                  disabled={isPending || reasonInput.trim().length < 10}
                  className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Suspend account
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}