/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  Store,
  ShoppingCart,
  Briefcase,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@prisma/client";
import { updateServiceAction } from "@/actions/admin/update-service";

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  status: ServiceStatus;
  price: number;
  deliveryDays: number;
  createdAt: string;
  creator: { id: string; name: string; image: string | null };
  category: { id: string; name: string } | null;
  _count: { orders: number; projects: number };
}

interface ServicesTableProps {
  services: ServiceRow[];
  statusCounts: {
    ACTIVE: number;
    PAUSED: number;
    ARCHIVED: number;
  };
  initialQuery: string;
  initialStatus: string;
  total: number;
  currentPage: number;
  totalPages: number;
}

const STATUS_BADGE: Record<ServiceStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ARCHIVED: "bg-slate-700/50 text-slate-400 border-slate-700",
};

const STATUS_TOAST: Record<
  ServiceStatus,
  { title: string; description: string }
> = {
  ACTIVE: {
    title: "Service activated ▶️",
    description: "The service is now visible in the marketplace.",
  },
  PAUSED: {
    title: "Service paused ⏸️",
    description: "The service is now hidden from buyers.",
  },
  ARCHIVED: {
    title: "Service archived 🗄️",
    description: "The service has been archived and is no longer active.",
  },
};

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

function ServiceThumb({
  id,
  title,
  thumbnail,
  size = 44,
}: {
  id: string;
  title: string;
  thumbnail: string | null;
  size?: number;
}) {
  if (thumbnail) {
    return (
      <Image
        src={thumbnail}
        alt={title}
        width={size}
        height={size}
        className="rounded-xl object-cover ring-2 ring-slate-800 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center bg-linear-to-br ring-2 ring-slate-800 shrink-0",
        getGradient(id)
      )}
      style={{ width: size, height: size }}
    >
      <span className="text-white/60 font-bold" style={{ fontSize: size * 0.4 }}>
        {title.charAt(0)}
      </span>
    </div>
  );
}

export function ServicesTable({
  services,
  statusCounts,
  initialQuery,
  initialStatus,
  total,
  currentPage,
  totalPages,
}: ServicesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);

  const activeStatus = searchParams.get("status") ?? "";

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
    const timer = setTimeout(() => updateURL({ q: value }), 350);
    return () => clearTimeout(timer);
  };

  const handleStatusFilter = (status: string) => updateURL({ status });

  const handleChangeStatus = (service: ServiceRow, status: ServiceStatus) => {
    setOpenMenuId(null);
    setActionError(null);
    setPendingServiceId(service.id);

    const toastId = toast.loading(`Updating to ${status.toLowerCase()}…`);

    startTransition(async () => {
      const result = await updateServiceAction({
        serviceId: service.id,
        action: "CHANGE_STATUS",
        status,
      });
      setPendingServiceId(null);

      if (!result.success) {
        const errorMessage =
          result.error === "FORBIDDEN"
            ? "Only admins can perform this action."
            : "Action failed.";

        setActionError(errorMessage);
        toast.error("Update failed", {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      const toastConfig = STATUS_TOAST[status];
      toast.success(toastConfig.title, {
        id: toastId,
        description: toastConfig.description,
      });
      router.refresh();
    });
  };

  const filters = [
    {
      value: "",
      label: "All",
      count:
        statusCounts.ACTIVE + statusCounts.PAUSED + statusCounts.ARCHIVED,
    },
    { value: "ACTIVE", label: "Active", count: statusCounts.ACTIVE },
    { value: "PAUSED", label: "Paused", count: statusCounts.PAUSED },
    { value: "ARCHIVED", label: "Archived", count: statusCounts.ARCHIVED },
  ];

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
            placeholder="Search by title or description…"
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
            const active = activeStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleStatusFilter(f.value)}
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

      {/* Results count */}
      {total > 0 && (
        <p className="text-xs text-slate-500">
          Showing {services.length > 0 ? (currentPage - 1) * 20 + 1 : 0}–
          {Math.min(currentPage * 20, total)} of {total}
          {totalPages > 1 && (
            <span className="text-slate-600 ml-2">
              · Page {currentPage} of {totalPages}
            </span>
          )}
        </p>
      )}

      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{actionError}</p>
        </div>
      )}

      {services.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-slate-600" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            No services found
          </h2>
          <p className="text-sm text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-visible">
          <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-4 px-5 py-3 border-b border-slate-800 bg-slate-900/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Service
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Creator
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Stats
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Status
            </span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-slate-800">
            {services.map((s, idx) => {
              const isPendingService = pendingServiceId === s.id;
              const isLastRow = idx === services.length - 1;

              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 lg:grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-slate-800/40 transition-colors"
                >
                  {/* Service */}
                  <div className="flex items-center gap-3 min-w-0">
                    <ServiceThumb
                      id={s.id}
                      title={s.title}
                      thumbnail={s.thumbnail}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {s.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {s.category?.name ?? "Uncategorized"} · $
                        {s.price.toFixed(2)} ·{" "}
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {s.deliveryDays}d
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Creator */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Creator:
                    </span>
                    <Link
                      href={`/profile/${s.creator.id}`}
                      className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      {s.creator.name}
                    </Link>
                  </div>

                  {/* Stats */}
                  <div className="flex lg:block gap-3 text-xs text-slate-500">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Stats:
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      {s._count.orders}
                    </span>
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Briefcase className="w-3 h-3" />
                      {s._count.projects}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Status:
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        STATUS_BADGE[s.status]
                      )}
                    >
                      {s.status}
                    </span>
                  </div>

                  {/* Menu */}
                  <div className="relative lg:justify-self-end">
                    {isPendingService ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === s.id ? null : s.id)
                        }
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                        aria-label="Service actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}

                    {openMenuId === s.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div
                          className={cn(
                            "absolute right-0 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 overflow-hidden z-20",
                            "animate-slide-down",
                            isLastRow
                              ? "bottom-full mb-1 origin-bottom-right"
                              : "top-full mt-1 origin-top-right"
                          )}
                        >
                          <a
                            href={`/marketplace/services/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Public
                          </a>
                          <div className="h-px bg-slate-800" />
                          <div className="px-3 py-2 border-b border-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                              Change status
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "ACTIVE")}
                            disabled={s.status === "ACTIVE"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "PAUSED")}
                            disabled={s.status === "PAUSED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "ARCHIVED")}
                            disabled={s.status === "ARCHIVED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Archive
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
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              ← Previous
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
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                  )}
                >
                  {p}
                </Link>
              );
            }
            if (p === currentPage - 2 || p === currentPage + 2) {
              return (
                <span key={p} className="text-slate-700 text-xs">
                  …
                </span>
              );
            }
            return null;
          })}

          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}