"use client";

import {
  useState,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Zap,
  ChevronRight,
  MessageSquare,
  DollarSign,
  CalendarDays,
  User,
  RotateCcw,
  Flag,
  Play,
  Award,
  X,
  Loader2,
  ExternalLink,
  Package,
  ShieldCheck,
} from "lucide-react";
import { MilestoneStatus, ProjectStatus } from "@prisma/client";
import {
  startMilestoneAction,
  requestMilestoneReviewAction,
  requestMilestoneRevisionAction,
  approveProjectCompletionAction,
} from "@/actions/projects/update-project";
import { cn } from "@/lib/utils";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface SerializedMilestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  order: number;
  amount: number | null;
  completedAt: string | null;
  revisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedProject {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  deadline: string | null;
  status: ProjectStatus;
  tags: string[];
  createdAt: string;
  clientId: string;
  creatorId: string | null;
  client: { id: string; name: string; image: string | null; email: string };
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
  } | null;
  service: {
    id: string;
    title: string;
    slug: string;
    price: number;
    deliveryDays: number;
  } | null;
  milestones: SerializedMilestone[];
  chatRoom: { id: string; messageCount: number } | null;
}

interface ProjectViewProps {
  project: SerializedProject;
  currentUserId: string;
  isClient: boolean;
  isCreator: boolean;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const MILESTONE_STATUS = {
  [MilestoneStatus.PENDING]: {
    label: "Pending",
    icon: Clock,
    dot: "bg-slate-700 border-slate-600",
    text: "text-slate-400",
    badge: "bg-slate-800 text-slate-400 border-slate-700",
  },
  [MilestoneStatus.IN_PROGRESS]: {
    label: "In Progress",
    icon: Zap,
    dot: "bg-indigo-600 border-indigo-500",
    text: "text-indigo-300",
    badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  },
  [MilestoneStatus.REVIEW_REQUESTED]: {
    label: "Under Review",
    icon: Eye,
    dot: "bg-amber-500 border-amber-400",
    text: "text-amber-300",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  [MilestoneStatus.APPROVED]: {
    label: "Approved",
    icon: CheckCircle2,
    dot: "bg-emerald-600 border-emerald-500",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  [MilestoneStatus.REVISION_NEEDED]: {
    label: "Revision Needed",
    icon: AlertCircle,
    dot: "bg-red-600 border-red-500",
    text: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
} as const;

const PROJECT_STATUS = {
  [ProjectStatus.PENDING]: {
    label: "Awaiting Start",
    color: "text-slate-400",
    bg: "bg-slate-700",
    bar: "bg-slate-500",
    progress: 0,
  },
  [ProjectStatus.IN_PROGRESS]: {
    label: "In Progress",
    color: "text-indigo-300",
    bg: "bg-indigo-500/10",
    bar: "bg-indigo-500",
    progress: 50,
  },
  [ProjectStatus.REVIEW_REQUESTED]: {
    label: "Awaiting Approval",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    bar: "bg-amber-500",
    progress: 85,
  },
  [ProjectStatus.COMPLETED]: {
    label: "Completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    bar: "bg-emerald-500",
    progress: 100,
  },
  [ProjectStatus.CANCELLED]: {
    label: "Cancelled",
    color: "text-slate-500",
    bg: "bg-slate-800",
    bar: "bg-slate-600",
    progress: 0,
  },
  [ProjectStatus.DISPUTED]: {
    label: "Disputed",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    bar: "bg-orange-500",
    progress: 50,
  },
} as const;

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function dueDateMeta(iso: string | null): {
  text: string;
  className: string;
} {
  if (!iso) return { text: "No deadline", className: "text-slate-600" };

  const date = new Date(iso);
  const days = Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0)
    return {
      text: `${Math.abs(days)}d overdue`,
      className: "text-red-400 font-semibold",
    };
  if (days === 0) return { text: "Due today", className: "text-red-400 font-semibold" };
  if (days === 1) return { text: "Due tomorrow", className: "text-amber-400" };
  if (days <= 3)
    return { text: `Due in ${days}d`, className: "text-amber-400" };

  return {
    text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    className: "text-slate-500",
  };
}

function ParticipantAvatar({
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
    .map((p) => p[0])
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
        className="rounded-full object-cover ring-2 ring-slate-700"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-slate-700 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue}, 50%, 38%)`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Revision Note Form ───────────────────────────────────────────────────────

function RevisionForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (note: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [note, setNote] = useState("");
  const isValid = note.trim().length >= 10;

  return (
    <div className="mt-4 p-4 rounded-xl bg-slate-800/70 border border-red-500/20 space-y-3">
      <p className="text-xs font-semibold text-red-400">
        Describe what needs to be changed:
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Be specific — e.g. 'Please revise the header section and adjust the color palette to match the brand guidelines provided.'"
        rows={3}
        maxLength={500}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-600">
          {note.length}/500
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => isValid && onSubmit(note.trim())}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              "bg-red-600 hover:bg-red-500 text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Milestone Card ───────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  index,
  isLast,
  isCreator,
  isClient,
  projectStatus,
  onStart,
  onRequestReview,
  onRequestRevision,
  pendingId,
}: {
  milestone: SerializedMilestone;
  index: number;
  isLast: boolean;
  isCreator: boolean;
  isClient: boolean;
  projectStatus: ProjectStatus;
  onStart: (id: string) => void;
  onRequestReview: (id: string) => void;
  onRequestRevision: (id: string, note: string) => void;
  pendingId: string | null;
}) {
  const [revisionOpen, setRevisionOpen] = useState(false);
  const config = MILESTONE_STATUS[milestone.status];
  const StatusIcon = config.icon;
  const due = dueDateMeta(milestone.dueDate);
  const isPending = pendingId === milestone.id;
  const isProjectActive = ![
    ProjectStatus.COMPLETED,
    ProjectStatus.CANCELLED,
    ProjectStatus.DISPUTED,
  ].includes(projectStatus);

  return (
    <div className="flex gap-4 items-start">
      {/* ── Timeline indicator ─────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "w-10 h-10 rounded-full border-2 flex items-center justify-center z-10",
            config.dot
          )}
        >
          <StatusIcon className="w-4 h-4 text-white" />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 mt-1",
              milestone.status === MilestoneStatus.APPROVED
                ? "bg-emerald-500/30"
                : "bg-slate-800"
            )}
            style={{ minHeight: "3rem" }}
          />
        )}
      </div>

      {/* ── Milestone card ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 mb-6 last:mb-0 rounded-2xl border overflow-hidden transition-all",
          milestone.status === MilestoneStatus.APPROVED
            ? "bg-slate-900/60 border-emerald-500/15"
            : milestone.status === MilestoneStatus.REVIEW_REQUESTED
            ? "bg-slate-900 border-amber-500/20"
            : milestone.status === MilestoneStatus.REVISION_NEEDED
            ? "bg-slate-900 border-red-500/20"
            : milestone.status === MilestoneStatus.IN_PROGRESS
            ? "bg-slate-900 border-indigo-500/20"
            : "bg-slate-900 border-slate-800"
        )}
      >
        {/* Card header */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  Milestone {index + 1}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                    config.badge
                  )}
                >
                  <StatusIcon className="w-2.5 h-2.5" />
                  {config.label}
                </span>
              </div>
              <h3 className="text-base font-bold text-white leading-snug">
                {milestone.title}
              </h3>
            </div>

            {/* Amount */}
            {milestone.amount != null && (
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-slate-600 uppercase tracking-wider">
                  Value
                </p>
                <p className="text-lg font-black text-white leading-none">
                  ${milestone.amount}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {milestone.description && (
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              {milestone.description}
            </p>
          )}

          {/* Revision note callout */}
          {milestone.revisionNote &&
            milestone.status === MilestoneStatus.REVISION_NEEDED && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/15 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-0.5">
                    Revision Note
                  </p>
                  <p className="text-xs text-red-300/80">
                    {milestone.revisionNote}
                  </p>
                </div>
              </div>
            )}

          {/* Completed at */}
          {milestone.completedAt && (
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-400">
                Approved{" "}
                {new Date(milestone.completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Due date */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-600" />
            <span className={cn("text-xs", due.className)}>{due.text}</span>
          </div>
        </div>

        {/* ── Action strip ───────────────────────────────────────────── */}
        {isProjectActive && (
          <div className="border-t border-slate-800/80 px-5 py-3 bg-slate-800/20">
            {/* Creator actions */}
            {isCreator && (
              <div className="flex items-center gap-2 flex-wrap">
                {milestone.status === MilestoneStatus.PENDING && (
                  <button
                    onClick={() => onStart(milestone.id)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                      "bg-indigo-600 hover:bg-indigo-500 text-white",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    Start Work
                  </button>
                )}

                {(milestone.status === MilestoneStatus.IN_PROGRESS ||
                  milestone.status === MilestoneStatus.REVISION_NEEDED) && (
                  <button
                    onClick={() => onRequestReview(milestone.id)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                      "bg-amber-500 hover:bg-amber-400 text-slate-950",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    Submit for Review
                  </button>
                )}

                {milestone.status === MilestoneStatus.REVIEW_REQUESTED && (
                  <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Awaiting client review…
                  </p>
                )}

                {milestone.status === MilestoneStatus.APPROVED && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Milestone approved
                  </p>
                )}
              </div>
            )}

            {/* Client actions */}
            {isClient && (
              <div className="flex items-center gap-2 flex-wrap">
                {milestone.status === MilestoneStatus.REVIEW_REQUESTED &&
                  !revisionOpen && (
                    <>
                      <button
                        onClick={() =>
                          onRequestRevision(milestone.id, "__open__")
                        }
                        disabled={isPending}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                          "bg-slate-700 hover:bg-red-500/20 border border-slate-600 hover:border-red-500/30",
                          "text-slate-400 hover:text-red-400",
                          "disabled:opacity-50"
                        )}
                        // We use the revision form instead of direct action
                        onClick={() => setRevisionOpen(true)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Revision
                      </button>
                    </>
                  )}

                {milestone.status === MilestoneStatus.IN_PROGRESS && (
                  <p className="text-xs text-indigo-400/80 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Creator is working on this…
                  </p>
                )}

                {milestone.status === MilestoneStatus.PENDING && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Not started yet
                  </p>
                )}

                {milestone.status === MilestoneStatus.APPROVED && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    You approved this milestone
                  </p>
                )}
              </div>
            )}

            {/* Revision form (client only, inline) */}
            {isClient && revisionOpen && (
              <RevisionForm
                isPending={isPending}
                onCancel={() => setRevisionOpen(false)}
                onSubmit={(note) => {
                  setRevisionOpen(false);
                  onRequestRevision(milestone.id, note);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjectView({
  project,
  currentUserId,
  isClient,
  isCreator,
}: ProjectViewProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingMilestoneId, setPendingMilestoneId] = useState<string | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Local optimistic state for milestones and project status
  const [localMilestones, setLocalMilestones] = useState<SerializedMilestone[]>(
    project.milestones
  );
  const [localProjectStatus, setLocalProjectStatus] = useState<ProjectStatus>(
    project.status
  );

  const statusConfig = PROJECT_STATUS[localProjectStatus];

  // Computed milestone progress
  const completedCount = useMemo(
    () =>
      localMilestones.filter((m) => m.status === MilestoneStatus.APPROVED)
        .length,
    [localMilestones]
  );

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleStartMilestone = useCallback(
    (milestoneId: string) => {
      if (isPending) return;
      setActionError(null);
      setPendingMilestoneId(milestoneId);

      // Optimistic update
      setLocalMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? { ...m, status: MilestoneStatus.IN_PROGRESS }
            : m
        )
      );
      if (localProjectStatus === ProjectStatus.PENDING) {
        setLocalProjectStatus(ProjectStatus.IN_PROGRESS);
      }

      startTransition(async () => {
        const result = await startMilestoneAction(milestoneId);
        setPendingMilestoneId(null);

        if (!result.success) {
          // Rollback
          setLocalMilestones(project.milestones);
          setLocalProjectStatus(project.status);
          setActionError(result.message ?? "Failed to start milestone.");
        }
      });
    },
    [isPending, localProjectStatus, project.milestones, project.status]
  );

  const handleRequestReview = useCallback(
    (milestoneId: string) => {
      if (isPending) return;
      setActionError(null);
      setPendingMilestoneId(milestoneId);

      // Optimistic update
      const updatedMilestones = localMilestones.map((m) =>
        m.id === milestoneId
          ? { ...m, status: MilestoneStatus.REVIEW_REQUESTED }
          : m
      );
      setLocalMilestones(updatedMilestones);

      const terminalStatuses = new Set<MilestoneStatus>([
        MilestoneStatus.REVIEW_REQUESTED,
        MilestoneStatus.APPROVED,
      ]);
      const allSubmitted = updatedMilestones.every((m) =>
        terminalStatuses.has(m.status)
      );
      if (allSubmitted) setLocalProjectStatus(ProjectStatus.REVIEW_REQUESTED);

      startTransition(async () => {
        const result = await requestMilestoneReviewAction(milestoneId);
        setPendingMilestoneId(null);

        if (!result.success) {
          setLocalMilestones(project.milestones);
          setLocalProjectStatus(project.status);
          setActionError(result.message ?? "Failed to submit for review.");
        }
      });
    },
    [isPending, localMilestones, project.milestones, project.status]
  );

  const handleRequestRevision = useCallback(
    (milestoneId: string, note: string) => {
      if (isPending) return;
      setActionError(null);
      setPendingMilestoneId(milestoneId);

      // Optimistic update
      setLocalMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                status: MilestoneStatus.REVISION_NEEDED,
                revisionNote: note,
              }
            : m
        )
      );
      setLocalProjectStatus(ProjectStatus.IN_PROGRESS);

      startTransition(async () => {
        const result = await requestMilestoneRevisionAction(milestoneId, note);
        setPendingMilestoneId(null);

        if (!result.success) {
          setLocalMilestones(project.milestones);
          setLocalProjectStatus(project.status);
          setActionError(result.message ?? "Failed to request revision.");
        }
      });
    },
    [isPending, project.milestones, project.status]
  );

  const handleApproveCompletion = useCallback(() => {
    if (isPending) return;
    setActionError(null);
    setPendingProjectAction(true);

    // Optimistic update
    setLocalMilestones((prev) =>
      prev.map((m) =>
        m.status === MilestoneStatus.REVIEW_REQUESTED
          ? { ...m, status: MilestoneStatus.APPROVED, completedAt: new Date().toISOString() }
          : m
      )
    );
    setLocalProjectStatus(ProjectStatus.COMPLETED);

    startTransition(async () => {
      const result = await approveProjectCompletionAction(project.id);
      setPendingProjectAction(false);

      if (!result.success) {
        setLocalMilestones(project.milestones);
        setLocalProjectStatus(project.status);
        setActionError(result.message ?? "Failed to approve project.");
      }
    });
  }, [isPending, project.id, project.milestones, project.status]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Project Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard/projects"
                className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white truncate">
                  {project.title}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Started{" "}
                  {new Date(project.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Status badge */}
              <span
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                  localProjectStatus === ProjectStatus.COMPLETED
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : localProjectStatus === ProjectStatus.REVIEW_REQUESTED
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    : localProjectStatus === ProjectStatus.IN_PROGRESS
                    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                )}
              >
                {localProjectStatus === ProjectStatus.COMPLETED && (
                  <Award className="w-3.5 h-3.5" />
                )}
                {localProjectStatus === ProjectStatus.REVIEW_REQUESTED && (
                  <Eye className="w-3.5 h-3.5" />
                )}
                {localProjectStatus === ProjectStatus.IN_PROGRESS && (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {statusConfig.label}
              </span>

              {/* Chat button */}
              {project.chatRoom && (
                <Link
                  href={`/dashboard/chat/${project.chatRoom.id}`}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                  {project.chatRoom.messageCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {project.chatRoom.messageCount > 9
                        ? "9+"
                        : project.chatRoom.messageCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>
                {completedCount} of {localMilestones.length} milestones
                approved
              </span>
              <span className={statusConfig.color}>
                {statusConfig.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  statusConfig.bar
                )}
                style={{ width: `${statusConfig.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Global error banner ──────────────────────────────────────────────── */}
      {actionError && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="flex-1 text-sm text-red-300">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Main: Milestone Timeline ─────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                Milestones
              </h2>
              <span className="text-xs text-slate-600">
                {completedCount}/{localMilestones.length} done
              </span>
            </div>

            {/* Vertical Timeline */}
            <div>
              {localMilestones.map((milestone, i) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  index={i}
                  isLast={i === localMilestones.length - 1}
                  isCreator={isCreator}
                  isClient={isClient}
                  projectStatus={localProjectStatus}
                  onStart={handleStartMilestone}
                  onRequestReview={handleRequestReview}
                  onRequestRevision={handleRequestRevision}
                  pendingId={pendingMilestoneId}
                />
              ))}
            </div>

            {/* ── Client: Approve All Completion ────────────────────────────── */}
            {isClient &&
              localProjectStatus === ProjectStatus.REVIEW_REQUESTED && (
                <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-indigo-500/8 border border-emerald-500/20 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                    <ShieldCheck className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">
                    All Work Submitted
                  </h3>
                  <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">
                    The creator has submitted all milestones for your review.
                    Approving this will mark the project as complete and release
                    payment.
                  </p>
                  <button
                    onClick={handleApproveCompletion}
                    disabled={pendingProjectAction}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm",
                      "bg-emerald-600 hover:bg-emerald-500 text-white",
                      "shadow-lg shadow-emerald-500/20",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all active:scale-95"
                    )}
                  >
                    {pendingProjectAction ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {pendingProjectAction
                      ? "Processing…"
                      : "Approve & Complete Project"}
                  </button>
                </div>
              )}

            {/* ── Completed state ───────────────────────────────────────────── */}
            {localProjectStatus === ProjectStatus.COMPLETED && (
              <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-indigo-500/8 border border-emerald-500/20 text-center">
                <Award className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1.5">
                  Project Complete! 🎉
                </h3>
                <p className="text-slate-400 text-sm">
                  All milestones approved. This project has been successfully
                  delivered.
                </p>
              </div>
            )}
          </main>

          {/* ── Sidebar: Project Details ────────────────────────────────────── */}
          <aside className="w-full lg:w-72 xl:w-80 space-y-4 shrink-0">

            {/* Service info */}
            {project.service && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/40">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Service
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {project.service.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {project.service.deliveryDays} day delivery
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-600">Total Budget</span>
                    <span className="text-base font-black text-white">
                      ${project.budget ?? project.service.price}
                    </span>
                  </div>
                  <Link
                    href={`/marketplace/services/${project.service.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all border border-slate-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Service
                  </Link>
                </div>
              </div>
            )}

            {/* Parties */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/40">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Participants
                </p>
              </div>
              <div className="p-4 space-y-4">
                {/* Client */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">
                    Client
                  </p>
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar
                      name={project.client.name}
                      image={project.client.image}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {project.client.name}
                      </p>
                      {isClient && (
                        <span className="text-[10px] text-indigo-400 font-semibold">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-800" />

                {/* Creator */}
                {project.creator ? (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">
                      Creator
                    </p>
                    <div className="flex items-center gap-3">
                      <ParticipantAvatar
                        name={project.creator.name}
                        image={project.creator.image}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">
                          {project.creator.name}
                        </p>
                        {project.creator.headline && (
                          <p className="text-[10px] text-slate-500 truncate">
                            {project.creator.headline}
                          </p>
                        )}
                        {isCreator && (
                          <span className="text-[10px] text-indigo-400 font-semibold">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">No creator assigned</p>
                )}
              </div>
            </div>

            {/* Budget + Deadline */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/40">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Details
                </p>
              </div>
              <div className="p-4 space-y-3">
                {project.budget != null && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Budget</span>
                    </div>
                    <span className="text-sm font-bold text-white">
                      ${project.budget}
                    </span>
                  </div>
                )}

                {project.deadline && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Deadline</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        dueDateMeta(project.deadline).className
                      )}
                    >
                      {dueDateMeta(project.deadline).text}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Flag className="w-3.5 h-3.5" />
                    <span>Status</span>
                  </div>
                  <span className={cn("text-xs font-bold", statusConfig.color)}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Chat CTA */}
            {project.chatRoom && (
              <Link
                href={`/dashboard/chat/${project.chatRoom.id}`}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl",
                  "bg-indigo-500/8 hover:bg-indigo-500/12 border border-indigo-500/15 hover:border-indigo-500/25",
                  "transition-all group"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Project Chat
                  </p>
                  <p className="text-xs text-slate-500">
                    {project.chatRoom.messageCount}{" "}
                    {project.chatRoom.messageCount === 1 ? "message" : "messages"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}