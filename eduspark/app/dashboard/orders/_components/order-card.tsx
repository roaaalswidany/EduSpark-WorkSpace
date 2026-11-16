/* eslint-disable @typescript-eslint/no-unused-vars */
import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  DollarSign,
  MessageSquare,
  ArrowRight,
  Flag,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@prisma/client";

export interface OrderCardData {
  id: string;
  title: string;
  status: ProjectStatus;
  budget: number | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  counterpart: {
    id: string;
    name: string;
    headline: string | null;
    // ًں‘‡ طھظ… ط­ط°ظپ image ظ…ظ† ظ‡ظ†ط§
  };
  service: {
    title: string;
    thumbnail: string | null;
  } | null;
  milestoneStats: {
    total: number;
    completed: number;
  };
  chatRoomId: string | null;
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Awaiting Start",
    className: "bg-accent/50 text-muted-foreground border-border",
  },
  OPEN: {
    label: "Open",
    className: "bg-accent/50 text-muted-foreground border-border",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  REVIEW_REQUESTED: {
    label: "Under Review",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  DISPUTED: {
    label: "Disputed",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
};

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
];

function getGradient(id: string): string {
  const code = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

// ًں‘‡ طھظ… طھظ†ط¸ظٹظپ ط§ظ„ظ…ظƒظˆظ† ظ„ظٹطھط¬ط§ظ‡ظ„ ط§ظ„طµظˆط±
function CounterpartAvatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface OrderCardProps {
  order: OrderCardData;
  /** Whether the current user is the buyer (client) */
  isBuyer: boolean;
}

export function OrderCard({ order, isBuyer }: OrderCardProps) {
  const status = STATUS_CONFIG[order.status];
  const gradient = getGradient(order.id);
  const progress =
    order.milestoneStats.total > 0
      ? Math.round(
          (order.milestoneStats.completed / order.milestoneStats.total) * 100
        )
      : 0;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden hover:border-border transition-all group">
      {/* Top row: image + main info */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
        {/* Thumbnail */}
        <div
          className={cn(
            "w-full sm:w-32 h-32 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-linear-to-br",
            !order.service?.thumbnail && gradient
          )}
        >
          {order.service?.thumbnail ? (
            <Image
              src={order.service.thumbnail}
              alt={order.service.title}
              width={128}
              height={96}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/30 font-black text-2xl">
                {(order.service?.title ?? order.title).charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
                {isBuyer ? "Order" : "Incoming Order"}
              </p>
              <h3 className="text-sm font-bold text-white line-clamp-1">
                {order.service?.title ?? order.title}
              </h3>
            </div>
            <span
              className={cn(
                "shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border",
                status.className
              )}
            >
              <Flag className="w-2.5 h-2.5 mr-1" />
              {status.label}
            </span>
          </div>

          {/* Counterpart */}
          <div className="flex items-center gap-2 mb-3">
            {/* ًں‘‡ طھظ… ط¥ط²ط§ظ„ط© طھظ…ط±ظٹط± ط§ظ„طµظˆط±ط© ظ‡ظ†ط§ */}
            <CounterpartAvatar
              name={order.counterpart.name}
              size={28}
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                <span className="text-muted-foreground/70">
                  {isBuyer ? "Creator: " : "Client: "}
                </span>
                {order.counterpart.name}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {order.budget !== null && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span className="text-foreground font-semibold tabular-nums">
                  ${order.budget.toFixed(2)}
                </span>
              </span>
            )}
            {order.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(order.deadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground/70">Updated</span>
              {formatRelative(order.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {order.milestoneStats.total > 0 && (
        <div className="px-4 sm:px-5 pb-3">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/70 mb-1.5">
            <span>
              {order.milestoneStats.completed} of {order.milestoneStats.total}{" "}
              milestones
            </span>
            <span
              className={cn(
                "tabular-nums",
                progress === 100 ? "text-emerald-400" : "text-primary"
              )}
            >
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-accent rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress === 100
                  ? "bg-linear-to-r from-emerald-500 to-teal-400"
                  : "bg-linear-to-r from-indigo-500 to-violet-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-border bg-background/40">
        <Link
          href={`/dashboard/projects/${order.id}`}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-bold transition-all",
            "bg-primary hover:bg-primary text-white shadow-lg shadow-indigo-500/10 active:scale-95"
          )}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Open Project
        </Link>
        {order.chatRoomId && (
          <Link
            href={`/dashboard/chat/${order.chatRoomId}`}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-lg text-xs font-bold transition-all",
              "bg-accent hover:bg-accent text-foreground border border-border active:scale-95"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </Link>
        )}
      </div>
    </div>
  );
}