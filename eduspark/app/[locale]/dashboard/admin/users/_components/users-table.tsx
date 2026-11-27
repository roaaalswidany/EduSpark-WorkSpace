/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import {
  useState,
  useTransition,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  CREATOR:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  STUDENT: "bg-accent/50 text-muted-foreground border-border",
};

const ROLE_KEYS: Record<Role, "student" | "creator" | "admin"> = {
  ADMIN: "admin",
  CREATOR: "creator",
  STUDENT: "student",
};

const FILTER_KEYS: Record<string, string> = {
  "": "all",
  STUDENT: "students",
  CREATOR: "creators",
  ADMIN: "admins",
};

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
      className="rounded-xl flex items-center justify-center text-white text-xs font-bold ring-2 ring-border shrink-0"
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
  initialRole: _initialRole,
  total,
  currentPage,
  totalPages,
}: UsersTableProps) {
  const t = useTranslations("admin.users.table");
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

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeRole = searchParams.get("role") ?? "";

  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRoleFilter = (role: string) => {
    updateURL({ role });
  };

  const executeToggle = (user: UserRow, reason?: string) => {
    setPendingUserId(user.id);

    const isSuspending = user.isActive;
    const toastId = toast.loading(
      isSuspending ? t("toasts.suspending") : t("toasts.activating")
    );

    startTransition(async () => {
      const result = await updateUserAction({
        userId: user.id,
        action: "TOGGLE_ACTIVE",
        reason,
      });
      setPendingUserId(null);

      if (!result.success) {
        const errorMap: Record<string, string> = {
          CANNOT_MODIFY_SELF: t("errors.cannotModifySelf"),
          FORBIDDEN: t("errors.forbidden"),
          NOT_FOUND: t("errors.notFound"),
          INVALID_INPUT: t("errors.invalidInput"),
        };
        const errorMessage = errorMap[result.error] ?? t("errors.actionFailed");

        setActionError(errorMessage);
        toast.error(t("toasts.actionFailed"), {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      toast.success(
        isSuspending ? t("toasts.suspended") : t("toasts.activated"),
        {
          id: toastId,
          description: isSuspending
            ? t("toasts.suspendedDesc", { name: user.name })
            : t("toasts.activatedDesc", { name: user.name }),
        }
      );
      router.refresh();
    });
  };

  const handleToggleActive = (user: UserRow) => {
    setOpenMenuId(null);
    setActionError(null);

    if (!user.isActive) {
      executeToggle(user, undefined);
      return;
    }

    setSuspendDialog({ userId: user.id, userName: user.name });
    setReasonInput("");
    setReasonError(null);
  };

  const handleConfirmSuspend = () => {
    if (!suspendDialog) return;

    const trimmed = reasonInput.trim();
    if (trimmed.length < 10) {
      setReasonError(t("suspendDialog.reasonError"));
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

    const roleLabel = t(`roleLabels.${ROLE_KEYS[role]}`);
    const toastId = toast.loading(t("toasts.updatingRole", { role: roleLabel }));

    startTransition(async () => {
      const result = await updateUserAction({
        userId: user.id,
        action: "CHANGE_ROLE",
        role,
      });
      setPendingUserId(null);

      if (!result.success) {
        const errorMap: Record<string, string> = {
          CANNOT_MODIFY_SELF: t("errors.cannotModifySelf"),
          FORBIDDEN: t("errors.forbidden"),
          NOT_FOUND: t("errors.notFound"),
        };
        const errorMessage = errorMap[result.error] ?? t("errors.actionFailed");

        setActionError(errorMessage);
        toast.error(t("toasts.roleUpdateFailed"), {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      toast.success(t("toasts.roleUpdated", { role: roleLabel }), {
        id: toastId,
        description: t("toasts.roleUpdatedDesc", { name: user.name }),
      });
      router.refresh();
    });
  };

  const filters = [
    {
      value: "",
      label: t(`filters.${FILTER_KEYS[""]}`),
      count: roleCounts.STUDENT + roleCounts.CREATOR + roleCounts.ADMIN,
    },
    {
      value: "STUDENT",
      label: t("filters.students"),
      count: roleCounts.STUDENT,
    },
    {
      value: "CREATOR",
      label: t("filters.creators"),
      count: roleCounts.CREATOR,
    },
    { value: "ADMIN", label: t("filters.admins"), count: roleCounts.ADMIN },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={cn(
              "w-full h-11 pl-10 pr-10 rounded-xl",
              "bg-card border border-border text-foreground",
              "placeholder:text-muted-foreground/70",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("showingRange", {
            start: users.length > 0 ? (currentPage - 1) * 20 + 1 : 0,
            end: Math.min(currentPage * 20, total),
            total,
          })}
          {totalPages > 1 && (
            <span className="text-muted-foreground/70 ml-2">
              · {t("pageOf", { page: currentPage, total: totalPages })}
            </span>
          )}
        </p>
      )}

      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      {users.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center mx-auto mb-5">
            <Search className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("noUsers")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("noUsersDesc")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-visible">
          <div className="hidden lg:grid grid-cols-[1.5fr_0.8fr_1.7fr_0.6fr_auto] gap-4 px-5 py-3 border-b border-border bg-card/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.user")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.role")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.activity")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.status")}
            </span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-border">
            {users.map((u, idx) => {
              const isSelf = u.id === currentUserId;
              const isPendingUser = pendingUserId === u.id;
              const isLastRow = idx === users.length - 1;

              return (
                <div
                  key={u.id}
                  className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr_1.7fr_0.6fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-12 lg:pr-0">
                    <Avatar name={u.name} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                        {u.name}
                        {isSelf && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {t("youBadge")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex lg:block min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">
                      {t("mobileLabels.role")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        ROLE_BADGE[u.role]
                      )}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {t(`roleLabels.${ROLE_KEYS[u.role]}`)}
                    </span>
                  </div>

                  <div className="flex lg:block gap-3 text-xs text-muted-foreground min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center shrink-0">
                      {t("mobileLabels.activity")}
                    </span>
                    <span className="truncate">
                      {u._count.enrollments} · {u._count.certificates} ·{" "}
                      {u._count.services}
                    </span>
                  </div>

                  <div className="flex lg:block min-w-0">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center shrink-0">
                      {t("mobileLabels.status")}
                    </span>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("status.active")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold whitespace-nowrap">
                        <XCircle className="w-3.5 h-3.5" />
                        {t("status.suspended")}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 lg:static lg:justify-self-end">
                    {isPendingUser ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === u.id ? null : u.id)
                        }
                        disabled={isSelf}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("actionsAria")}
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
                            "absolute right-0 rtl:right-auto rtl:left-0 w-52 rounded-xl bg-card border border-border shadow-2xl shadow-black/60 overflow-hidden z-20",
                            "animate-slide-down",
                            isLastRow
                              ? "bottom-full mb-1 origin-bottom-right rtl:origin-bottom-left"
                              : "top-full mt-1 origin-top-right rtl:origin-top-left"
                          )}
                        >
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                              {t("menu.changeRole")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "STUDENT")}
                            disabled={u.role === "STUDENT"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.makeStudent")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "CREATOR")}
                            disabled={u.role === "CREATOR"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.makeCreator")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeRole(u, "ADMIN")}
                            disabled={u.role === "ADMIN"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.makeAdmin")}
                          </button>
                          <div className="h-px bg-accent" />
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            className={cn(
                              "w-full text-left px-3.5 py-2 text-xs transition-colors",
                              u.isActive
                                ? "text-destructive hover:bg-destructive/10"
                                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            )}
                          >
                            {u.isActive
                              ? t("menu.suspendAccount")
                              : t("menu.activateAccount")}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/40 text-foreground text-xs font-semibold transition-colors"
            >
              ← {t("pagination.previous")}
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
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}
                </Link>
              );
            }
            if (p === currentPage - 2 || p === currentPage + 2) {
              return (
                <span key={p} className="text-muted-foreground/70 text-xs">
                  ...
                </span>
              );
            }
            return null;
          })}

          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/40 text-foreground text-xs font-semibold transition-colors"
            >
              {t("pagination.next")} →
            </Link>
          )}
        </div>
      )}

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
                  <h3 className="text-lg font-bold text-foreground">
                    {t("suspendDialog.title")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("suspendDialog.descBefore")}{" "}
                  <strong className="text-foreground">
                    {suspendDialog.userName}
                  </strong>
                  {t("suspendDialog.descAfter")}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {t("suspendDialog.reasonLabel")}
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
                  placeholder={t("suspendDialog.reasonPlaceholder")}
                />
                {reasonError && (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {reasonError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  {t("suspendDialog.reasonCounter", {
                    count: reasonInput.trim().length,
                  })}
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
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {t("suspendDialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSuspend}
                  disabled={isPending || reasonInput.trim().length < 10}
                  className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {t("suspendDialog.suspend")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}