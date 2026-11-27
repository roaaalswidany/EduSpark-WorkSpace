"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreVertical,
  Eye,
  Pencil,
  Pause,
  Play,
  Trash2,
  Clock,
  AlertCircle,
  Loader2,
  Briefcase,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@prisma/client";
import { updateServiceStatusAction } from "@/actions/marketplace/update-service-status";
import { deleteServiceAction } from "@/actions/marketplace/delete-service";

interface ServiceCardData {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  revisions: number;
  status: ServiceStatus;
  reviewNote?: string | null;
  tags: string[];
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
  _count: { orders: number; projects: number };
}

// Only classes here — labels come from t()
const STATUS_STYLES: Record<
  ServiceStatus,
  { dot: string; badge: string; key: string }
> = {
  PENDING_REVIEW: {
    key: "pendingReview",
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  ACTIVE: {
    key: "active",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  PAUSED: {
    key: "paused",
    dot: "bg-amber-500",
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  ARCHIVED: {
    key: "archived",
    dot: "bg-muted-foreground/50",
    badge: "bg-accent/40 text-muted-foreground border-border",
  },
};

const GRADIENTS = [
  "from-emerald-600 to-emerald-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-emerald-600 to-purple-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

function DeleteDialog({
  serviceTitle,
  isPending,
  error,
  onCancel,
  onConfirm,
}: {
  serviceTitle: string;
  isPending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("creatorServices.deleteDialog");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={isPending ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t("title")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("confirmText", { title: serviceTitle })}
          </p>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-background/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold",
              "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
              "active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-destructive/20"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("deleting")}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {t("delete")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreatorServiceCard({ service }: { service: ServiceCardData }) {
  const t = useTranslations("creatorServices");
  const router = useRouter();
  const [status, setStatus] = useState<ServiceStatus>(service.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusPending, startStatusTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement>(null);
  const gradient = getGradient(service.id);
  const config = STATUS_STYLES[status];
  const statusLabel = t(`statuses.${config.key}`);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleStatusChange = useCallback(
    (newStatus: ServiceStatus) => {
      setMenuOpen(false);
      setStatusError(null);

      const previous = status;
      setStatus(newStatus);

      let loadingMessage = t("statusToasts.updating");
      if (newStatus === "PAUSED") loadingMessage = t("statusToasts.pausing");
      if (newStatus === "ACTIVE") loadingMessage = t("statusToasts.activating");
      if (newStatus === "PENDING_REVIEW")
        loadingMessage = t("statusToasts.submitting");

      const toastId = toast.loading(loadingMessage);

      startStatusTransition(async () => {
        const result = await updateServiceStatusAction({
          serviceId: service.id,
          status: newStatus,
        });

        if (!result.success) {
          setStatus(previous);
          const errorMap: Record<string, string> = {
            INVALID_TRANSITION: t("statusToasts.errorInvalidTransition"),
            FORBIDDEN: t("statusToasts.errorForbidden"),
          };
          const errorMessage =
            errorMap[result.error] ?? t("statusToasts.errorGeneric");

          setStatusError(errorMessage);
          toast.error(t("statusToasts.failed"), {
            id: toastId,
            description: errorMessage,
          });
          setTimeout(() => setStatusError(null), 3000);
        } else {
          toast.success(t("statusToasts.success"), {
            id: toastId,
            description: t("statusToasts.successDesc"),
          });
          router.refresh();
        }
      });
    },
    [status, service.id, router, t]
  );

  const handleDelete = useCallback(() => {
    setDeleteError(null);
    const toastId = toast.loading(t("deleteDialog.toastLoading"));

    startDeleteTransition(async () => {
      const result = await deleteServiceAction({ serviceId: service.id });

      if (!result.success) {
        const errorMap: Record<string, string> = {
          HAS_ORDERS: t("deleteDialog.errors.hasOrders"),
          FORBIDDEN: t("deleteDialog.errors.forbidden"),
          NOT_FOUND: t("deleteDialog.errors.notFound"),
        };
        const errorMessage =
          errorMap[result.error] ?? t("deleteDialog.errors.generic");

        setDeleteError(errorMessage);
        toast.error(t("deleteDialog.toastFailed"), {
          id: toastId,
          description: errorMessage,
        });
        return;
      }

      toast.success(t("deleteDialog.toastSuccess"), {
        id: toastId,
        description: t("deleteDialog.toastSuccessDesc"),
      });
      setDeleteOpen(false);
      router.refresh();
    });
  }, [service.id, router, t]);

  const isAnyPending = isStatusPending || isDeletePending;

  return (
    <>
      <div className="group rounded-2xl bg-card border border-border overflow-hidden flex flex-col hover:border-primary/40 transition-all">
        <div
          className={cn(
            "relative aspect-video bg-linear-to-br overflow-hidden",
            !service.thumbnail && gradient
          )}
        >
          {service.thumbnail ? (
            <Image
              src={service.thumbnail}
              alt={service.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-black text-white/20 select-none"
                style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}
              >
                {service.title.charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute top-2.5 left-2.5 rtl:left-auto rtl:right-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
                config.badge
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
              {statusLabel}
            </span>
          </div>

          <div
            ref={menuRef}
            className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5"
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={isAnyPending}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/55 backdrop-blur-sm hover:bg-black/75 text-white transition-colors disabled:opacity-50"
              aria-label={t("card.actionsAria")}
            >
              {isStatusPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MoreVertical className="w-4 h-4" />
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-1.5 w-48 rounded-xl bg-card border border-border shadow-2xl shadow-black/60 overflow-hidden z-20 animate-slide-down origin-top-right rtl:origin-top-left">
                <Link
                  href={`/marketplace/services/${service.slug}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {t("card.viewPublic")}
                </Link>
                <Link
                  href={`/dashboard/creator/services/${service.id}/edit`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("card.editService")}
                </Link>

                {status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("PAUSED")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent transition-colors text-left"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    {t("card.pauseService")}
                  </button>
                )}

                {status === "PENDING_REVIEW" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("PAUSED")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t("card.withdrawSubmission")}
                  </button>
                )}

                {status === "PAUSED" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("PENDING_REVIEW")}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-sky-700 dark:text-sky-400 hover:bg-sky-500/10 transition-colors text-left"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {t("card.submitForReview")}
                  </button>
                )}

                <div className="h-px bg-accent" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("card.deleteService")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col flex-1 p-4 gap-3">
          {service.category && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {service.category.name}
            </span>
          )}

          <Link
            href={`/marketplace/services/${service.slug}`}
            className="text-sm font-bold text-foreground line-clamp-2 leading-snug hover:text-primary transition-colors"
          >
            {service.title}
          </Link>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {t("card.ordersCount", { count: service._count.orders })}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {t("card.projectsCount", { count: service._count.projects })}
            </span>
          </div>

          <div className="flex items-end justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Clock className="w-3 h-3" />
              <span>{service.deliveryDays}d</span>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                {t("card.from")}
              </p>
              <p className="text-base font-black text-foreground leading-none tabular-nums">
                $
                {service.price % 1 === 0
                  ? service.price
                  : service.price.toFixed(2)}
              </p>
            </div>
          </div>

          {status === "PAUSED" && service.reviewNote && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <strong>{t("card.changesRequested")}</strong>{" "}
                {service.reviewNote}
              </span>
            </div>
          )}

          {statusError && (
            <div className="flex items-center gap-1.5 text-[10px] text-destructive">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {statusError}
            </div>
          )}
        </div>
      </div>

      {deleteOpen && (
        <DeleteDialog
          serviceTitle={service.title}
          isPending={isDeletePending}
          error={deleteError}
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}