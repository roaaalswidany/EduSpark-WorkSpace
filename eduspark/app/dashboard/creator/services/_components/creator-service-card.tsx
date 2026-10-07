"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react";
import Image from "next/image";
import Link from "next/link";
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
  tags: string[];
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
  _count: { orders: number; projects: number };
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; dot: string; badge: string }
> = {
  ACTIVE: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  PAUSED: {
    label: "Paused",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  ARCHIVED: {
    label: "Archived",
    dot: "bg-slate-500",
    badge: "bg-slate-700/40 text-slate-400 border-slate-700",
  },
};

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isPending ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Delete Service</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{serviceTitle}</span>?
            This will permanently remove it from the marketplace.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreatorServiceCard({ service }: { service: ServiceCardData }) {
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
  const config = STATUS_CONFIG[status];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleToggleStatus = useCallback(() => {
    setMenuOpen(false);
    setStatusError(null);

    const newStatus: ServiceStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const previous = status;
    const isPausing = newStatus === "PAUSED";

    // Optimistic update
    setStatus(newStatus);

    const toastId = toast.loading(
      isPausing ? "Pausing service…" : "Activating service…"
    );

    startStatusTransition(async () => {
      const result = await updateServiceStatusAction({
        serviceId: service.id,
        status: newStatus,
      });

      if (!result.success) {
        setStatus(previous);
        const errorMessage =
          result.error === "FORBIDDEN"
            ? "You don't have permission."
            : "Failed to update status.";

        setStatusError(errorMessage);
        toast.error("Status update failed", {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setStatusError(null), 3000);
      } else {
        toast.success(
          isPausing ? "Service paused ⏸️" : "Service activated ▶️",
          {
            id: toastId,
            description: isPausing
              ? "Your service is now hidden from the marketplace."
              : "Your service is now visible to buyers.",
          }
        );
        router.refresh();
      }
    });
  }, [status, service.id, router]);

  const handleDelete = useCallback(() => {
    setDeleteError(null);

    const toastId = toast.loading("Deleting service…");

    startDeleteTransition(async () => {
      const result = await deleteServiceAction({ serviceId: service.id });

      if (!result.success) {
        const messages: Record<string, string> = {
          HAS_ORDERS:
            "This service has orders or projects. Pause it instead of deleting.",
          FORBIDDEN: "You don't have permission to delete this service.",
          NOT_FOUND: "Service not found.",
        };
        const errorMessage =
          messages[result.error] ?? "Failed to delete service.";

        setDeleteError(errorMessage);
        toast.error("Deletion failed", {
          id: toastId,
          description: errorMessage,
        });
        return;
      }

      toast.success("Service deleted", {
        id: toastId,
        description: "The service has been removed from the marketplace.",
      });
      setDeleteOpen(false);
      router.refresh();
    });
  }, [service.id, router]);

  const isAnyPending = isStatusPending || isDeletePending;

  return (
    <>
      <div className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col hover:border-slate-700 transition-all">
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

          <div className="absolute top-2.5 left-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
                config.badge
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
              {config.label}
            </span>
          </div>

          <div ref={menuRef} className="absolute top-2.5 right-2.5">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={isAnyPending}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/55 backdrop-blur-sm hover:bg-black/75 text-white transition-colors disabled:opacity-50"
              aria-label="Service actions"
            >
              {isStatusPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MoreVertical className="w-4 h-4" />
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 overflow-hidden z-20">
                <Link
                  href={`/marketplace/services/${service.slug}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Public
                </Link>
                <Link
                  href={`/dashboard/creator/services/${service.id}/edit`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Service
                </Link>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                >
                  {status === "ACTIVE" ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Pause Service
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Activate Service
                    </>
                  )}
                </button>
                <div className="h-px bg-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Service
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col flex-1 p-4 gap-3">
          {service.category && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
              {service.category.name}
            </span>
          )}

          <Link
            href={`/marketplace/services/${service.slug}`}
            className="text-sm font-bold text-slate-200 line-clamp-2 leading-snug hover:text-white transition-colors"
          >
            {service.title}
          </Link>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-auto pt-2">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {service._count.orders} orders
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {service._count.projects} projects
            </span>
          </div>

          <div className="flex items-end justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>{service.deliveryDays}d</span>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium text-slate-600 uppercase tracking-wider">
                From
              </p>
              <p className="text-base font-black text-white leading-none tabular-nums">
                $
                {service.price % 1 === 0
                  ? service.price
                  : service.price.toFixed(2)}
              </p>
            </div>
          </div>

          {statusError && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400">
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