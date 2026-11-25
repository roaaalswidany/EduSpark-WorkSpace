/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import {
  useState,
  useTransition,
  useCallback,
  useRef,
  useEffect,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  XCircle,
  MoreVertical,
  ExternalLink,
  Store,
  ShoppingCart,
  Briefcase,
  Clock,
  Eye,
  FileText,
  LinkIcon,
  Tag,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@prisma/client";
import { updateServiceAction } from "@/actions/admin/update-service";
import { reviewServiceAction } from "@/actions/admin/review-service";
import { isHttpsUrl } from "@/lib/security/safe-url";

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  status: ServiceStatus;
  price: number;
  deliveryDays: number;
  revisions: number;
  tags: string[];
  portfolioLinks: string[];
  createdAt: string;
  creator: { id: string; name: string; image: string | null };
  category: { id: string; name: string } | null;
  _count: { orders: number; projects: number };
}

interface ServicesTableProps {
  services: ServiceRow[];
  statusCounts: {
    PENDING_REVIEW: number;
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
  PENDING_REVIEW:
    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  ACTIVE:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  PAUSED:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  ARCHIVED: "bg-accent/50 text-muted-foreground border-border",
};

const STATUS_KEYS: Record<ServiceStatus, string> = {
  PENDING_REVIEW: "pendingReview",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
};

const GRADIENTS = [
  "from-emerald-600 to-emerald-700",
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
        className="rounded-xl object-cover ring-2 ring-border shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center bg-linear-to-br ring-2 ring-border shrink-0",
        getGradient(id)
      )}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {title.charAt(0)}
      </span>
    </div>
  );
}

function ServiceDetailsModal({
  service,
  onClose,
  onApprove,
  onArchive,
}: {
  service: ServiceRow;
  onClose: () => void;
  onApprove: () => void;
  onArchive: () => void;
}) {
  const t = useTranslations("admin.services.table.modal");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-scale-in">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-full sm:w-64 shrink-0">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-background border border-border">
                <ServiceThumb
                  id={service.id}
                  title={service.title}
                  thumbnail={service.thumbnail}
                  size={256}
                />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mb-2",
                    STATUS_BADGE[service.status]
                  )}
                >
                  {t(`../statuses.${STATUS_KEYS[service.status]}`)}
                </span>
                <h1 className="text-xl font-bold text-foreground">
                  {service.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("by")}{" "}
                  <Link
                    href={`/profile/${service.creator.id}`}
                    className="text-primary hover:underline"
                  >
                    {service.creator.name}
                  </Link>
                  {service.category && <> · {service.category.name}</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />{" "}
                  {t("deliveryDays", { count: service.deliveryDays })}
                </span>
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />{" "}
                  {t("revisions", { count: service.revisions })}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" />{" "}
                  {t("orders", { count: service._count.orders })}
                </span>
              </div>
              <div className="pt-2">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${service.price.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> {t("description")}
            </h3>
            <div className="p-4 rounded-xl bg-background border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {service.description}
            </div>
          </div>

          {service.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> {t("tags")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-accent border border-border text-xs text-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {service.portfolioLinks.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-primary" />{" "}
                {t("portfolio")}
              </h3>
              <div className="space-y-2">
                {service.portfolioLinks.map((link, i) =>
                  isHttpsUrl(link) ? (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-primary transition-all"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                  ) : (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 rounded-lg bg-background border border-destructive/30 text-sm text-destructive"
                    >
                      <span className="truncate">
                        {t("unsafeLink", { url: link })}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border bg-background/40 flex items-center justify-end gap-3 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            {t("close")}
          </button>

          {service.status === "PENDING_REVIEW" && (
            <>
              <button
                onClick={onArchive}
                className="px-4 py-2 rounded-lg text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
              >
                {t("requestChanges")}
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> {t("approveActivate")}
              </button>
            </>
          )}

          {service.status !== "ARCHIVED" &&
            service.status !== "PENDING_REVIEW" && (
              <button
                onClick={onArchive}
                className="px-4 py-2 rounded-lg text-sm font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 transition-all"
              >
                {t("archive")}
              </button>
            )}
          {service.status === "PAUSED" && (
            <button
              onClick={onApprove}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> {t("approveActivate")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ServicesTable({
  services,
  statusCounts,
  initialQuery,
  initialStatus: _initialStatus,
  total,
  currentPage,
  totalPages,
}: ServicesTableProps) {
  const t = useTranslations("admin.services.table");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{
    serviceId: string;
    serviceTitle: string;
    mode: "ARCHIVE" | "REJECT";
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(
    null
  );

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateURL({ q: value }), 350);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleStatusFilter = (status: string) => updateURL({ status });

  const executeChangeStatus = (
    service: ServiceRow,
    status: ServiceStatus,
    reason?: string
  ) => {
    setPendingServiceId(service.id);
    const statusLabel = t(`statuses.${STATUS_KEYS[status]}`);
    const toastId = toast.loading(t("toasts.updating", { status: statusLabel }));

    startTransition(async () => {
      const result = await updateServiceAction({
        serviceId: service.id,
        action: "CHANGE_STATUS",
        status,
        reason,
      });
      setPendingServiceId(null);

      if (!result.success) {
        const errorMap: Record<string, string> = {
          FORBIDDEN: t("errors.forbidden"),
          NOT_FOUND: t("errors.notFound"),
          INVALID_INPUT: t("errors.invalidInput"),
        };
        const errorMessage = errorMap[result.error] ?? t("errors.actionFailed");

        setActionError(errorMessage);
        toast.error(t("toasts.updateFailed"), {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      const statusKey = STATUS_KEYS[status];
      toast.success(t(`statusToasts.${statusKey}Title`), {
        id: toastId,
        description: t(`statusToasts.${statusKey}Desc`),
      });
      setSelectedService(null);
      router.refresh();
    });
  };

  const handleChangeStatus = (service: ServiceRow, status: ServiceStatus) => {
    setOpenMenuId(null);
    setActionError(null);

    if (status === "ARCHIVED" && service.status !== "ARCHIVED") {
      setArchiveDialog({
        serviceId: service.id,
        serviceTitle: service.title,
        mode: "ARCHIVE",
      });
      setReasonInput("");
      setReasonError(null);
      return;
    }

    executeChangeStatus(service, status);
  };

  const runReview = (
    service: ServiceRow,
    decision: "APPROVE" | "REJECT",
    note?: string
  ) => {
    setPendingServiceId(service.id);
    const toastId = toast.loading(
      decision === "APPROVE" ? t("toasts.approving") : t("toasts.sendingFeedback")
    );

    startTransition(async () => {
      const result = await reviewServiceAction({
        serviceId: service.id,
        decision,
        note,
      });
      setPendingServiceId(null);

      if (!result.success) {
        const errorMap: Record<string, string> = {
          FORBIDDEN: t("errors.forbiddenReview"),
          INVALID_STATE: t("errors.invalidState"),
          INVALID_INPUT: t("errors.invalidInputReview"),
          NOT_FOUND: t("errors.notFound"),
        };
        const errorMessage = errorMap[result.error] ?? t("errors.actionFailed");
        setActionError(errorMessage);
        toast.error(t("toasts.reviewFailed"), {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        router.refresh();
        return;
      }

      toast.success(
        decision === "APPROVE" ? t("toasts.approved") : t("toasts.feedbackSent"),
        {
          id: toastId,
          description:
            decision === "APPROVE"
              ? t("toasts.approvedDesc")
              : t("toasts.feedbackSentDesc"),
        }
      );
      setSelectedService(null);
      router.refresh();
    });
  };

  const handleApprove = (service: ServiceRow) => {
    setOpenMenuId(null);
    setActionError(null);
    runReview(service, "APPROVE");
  };

  const handleRequestChanges = (service: ServiceRow) => {
    setOpenMenuId(null);
    setActionError(null);
    setArchiveDialog({
      serviceId: service.id,
      serviceTitle: service.title,
      mode: "REJECT",
    });
    setReasonInput("");
    setReasonError(null);
  };

  const handleConfirmArchive = () => {
    if (!archiveDialog) return;

    const trimmed = reasonInput.trim();
    if (trimmed.length < 10) {
      setReasonError(t("archiveDialog.reasonError"));
      return;
    }

    const target = services.find((s) => s.id === archiveDialog.serviceId);
    if (!target) return;

    if (archiveDialog.mode === "REJECT") {
      runReview(target, "REJECT", trimmed);
    } else {
      executeChangeStatus(target, "ARCHIVED", trimmed);
    }
    setArchiveDialog(null);
    setReasonInput("");
    setReasonError(null);
  };

  const filters = [
    {
      value: "",
      label: t("filters.all"),
      count: statusCounts.ACTIVE + statusCounts.PAUSED + statusCounts.ARCHIVED,
    },
    {
      value: "PENDING_REVIEW",
      label: t("filters.pendingReview"),
      count: statusCounts.PENDING_REVIEW,
    },
    { value: "ACTIVE", label: t("filters.active"), count: statusCounts.ACTIVE },
    { value: "PAUSED", label: t("filters.paused"), count: statusCounts.PAUSED },
    {
      value: "ARCHIVED",
      label: t("filters.archived"),
      count: statusCounts.ARCHIVED,
    },
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
            const active = activeStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleStatusFilter(f.value)}
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
            start: services.length > 0 ? (currentPage - 1) * 20 + 1 : 0,
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

      {services.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("noServices")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("noServicesDesc")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-visible">
          <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-4 px-5 py-3 border-b border-border bg-card/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.service")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.creator")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.stats")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("columns.status")}
            </span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-border">
            {services.map((s, idx) => {
              const isPendingService = pendingServiceId === s.id;
              const isLastRow = idx === services.length - 1;

              return (
                <div
                  key={s.id}
                  className="relative grid grid-cols-1 lg:grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-12 lg:pr-0">
                    <ServiceThumb id={s.id} title={s.title} thumbnail={s.thumbnail} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {s.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {s.category?.name ?? t("uncategorized")} · $
                        {s.price.toFixed(2)} ·{" "}
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {t("deliveryShort", { days: s.deliveryDays })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">
                      {t("mobileLabels.creator")}
                    </span>
                    <Link
                      href={`/profile/${s.creator.id}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {s.creator.name}
                    </Link>
                  </div>

                  <div className="flex lg:block gap-3 text-xs text-muted-foreground">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">
                      {t("mobileLabels.stats")}
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

                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">
                      {t("mobileLabels.status")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        STATUS_BADGE[s.status]
                      )}
                    >
                      {t(`statuses.${STATUS_KEYS[s.status]}`)}
                    </span>
                  </div>

                  <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 lg:static lg:justify-self-end">
                    {isPendingService ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === s.id ? null : s.id)
                        }
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t("actionsAria")}
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
                            "absolute right-0 rtl:right-auto rtl:left-0 w-56 rounded-xl bg-card border border-border shadow-2xl shadow-black/60 overflow-hidden z-20",
                            "animate-slide-down",
                            isLastRow
                              ? "bottom-full mb-1 origin-bottom-right rtl:origin-bottom-left"
                              : "top-full mt-1 origin-top-right rtl:origin-top-left"
                          )}
                        >
                          {s.status === "PENDING_REVIEW" && (
                            <>
                              <div className="px-3 py-2 border-b border-border">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                  {t("menu.reviewHeader")}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedService(s);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors text-left"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t("menu.reviewDetails")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprove(s)}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t("menu.approveAndActivate")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestChanges(s)}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                              >
                                {t("menu.requestChanges")}
                              </button>
                              <div className="h-px bg-accent" />
                            </>
                          )}

                          <a
                            href={`/marketplace/services/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("menu.viewPublic")}
                          </a>
                          <div className="h-px bg-accent" />
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                              {t("menu.changeStatus")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "ACTIVE")}
                            disabled={
                              s.status === "ACTIVE" ||
                              s.status === "PENDING_REVIEW"
                            }
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.activate")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "PAUSED")}
                            disabled={s.status === "PAUSED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.pause")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(s, "ARCHIVED")}
                            disabled={s.status === "ARCHIVED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t("menu.archive")}
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

      {archiveDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setArchiveDialog(null);
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
                    {archiveDialog.mode === "REJECT"
                      ? t("archiveDialog.rejectTitle")
                      : t("archiveDialog.archiveTitle")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {archiveDialog.mode === "REJECT"
                    ? t("archiveDialog.rejectDescBefore")
                    : t("archiveDialog.archiveDescBefore")}{" "}
                  <strong className="text-foreground">
                    &quot;{archiveDialog.serviceTitle}&quot;
                  </strong>
                  {archiveDialog.mode === "REJECT"
                    ? ` ${t("archiveDialog.rejectDescAfter")}`
                    : ` ${t("archiveDialog.archiveDescAfter")}`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {t("archiveDialog.reasonLabel")}
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
                  placeholder={t("archiveDialog.reasonPlaceholder")}
                />
                {reasonError && (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {reasonError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  {t("archiveDialog.reasonCounter", {
                    count: reasonInput.trim().length,
                  })}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveDialog(null);
                    setReasonInput("");
                    setReasonError(null);
                  }}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {t("archiveDialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  disabled={isPending || reasonInput.trim().length < 10}
                  className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {archiveDialog.mode === "REJECT"
                    ? t("archiveDialog.sendFeedback")
                    : t("archiveDialog.archive")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onApprove={() =>
            selectedService.status === "PENDING_REVIEW"
              ? runReview(selectedService, "APPROVE")
              : executeChangeStatus(selectedService, "ACTIVE")
          }
          onArchive={() => {
            setSelectedService(null);
            setArchiveDialog({
              serviceId: selectedService.id,
              serviceTitle: selectedService.title,
              mode:
                selectedService.status === "PENDING_REVIEW"
                  ? "REJECT"
                  : "ARCHIVE",
            });
            setReasonInput("");
            setReasonError(null);
          }}
        />
      )}
    </div>
  );
}