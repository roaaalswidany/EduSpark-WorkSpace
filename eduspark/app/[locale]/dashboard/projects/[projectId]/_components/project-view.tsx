/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  RotateCcw,
  Flag,
  Play,
  Award,
  X,
  Loader2,
  ExternalLink,
  Package,
  ShieldCheck,
  LinkIcon,
  FileText,
} from "lucide-react";
import { MilestoneStatus, ProjectStatus } from "@/lib/enums";
import {
  startMilestoneAction,
  requestMilestoneReviewAction,
  requestMilestoneRevisionAction,
  approveProjectCompletionAction,
} from "@/actions/projects/update-project";
import { cn } from "@/lib/utils";
import { isHttpsUrl } from "@/lib/security/safe-url";

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
  submissionNote: string | null;
  submissionUrl: string | null;
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

// ─── Status Config (classes only, labels via t()) ────────────────────────────

const MILESTONE_STATUS_CLASSES = {
  [MilestoneStatus.PENDING]: {
    icon: Clock,
    dot: "bg-muted-foreground/70 border-border",
    badge: "bg-accent text-muted-foreground border-border",
  },
  [MilestoneStatus.IN_PROGRESS]: {
    icon: Zap,
    dot: "bg-primary border-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  [MilestoneStatus.REVIEW_REQUESTED]: {
    icon: Eye,
    dot: "bg-amber-500 border-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  [MilestoneStatus.APPROVED]: {
    icon: CheckCircle2,
    dot: "bg-emerald-600 border-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  [MilestoneStatus.REVISION_NEEDED]: {
    icon: AlertCircle,
    dot: "bg-destructive border-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const;

const MILESTONE_STATUS_KEYS = {
  [MilestoneStatus.PENDING]: "pending",
  [MilestoneStatus.IN_PROGRESS]: "inProgress",
  [MilestoneStatus.REVIEW_REQUESTED]: "reviewRequested",
  [MilestoneStatus.APPROVED]: "approved",
  [MilestoneStatus.REVISION_NEEDED]: "revisionNeeded",
} as const;

const PROJECT_STATUS_CLASSES = {
  [ProjectStatus.PENDING]: {
    color: "text-muted-foreground",
    bar: "bg-muted-foreground/50",
    progress: 0,
  },
  [ProjectStatus.OPEN]: {
    color: "text-muted-foreground",
    bar: "bg-muted-foreground/50",
    progress: 0,
  },
  [ProjectStatus.IN_PROGRESS]: {
    color: "text-primary",
    bar: "bg-primary",
    progress: 50,
  },
  [ProjectStatus.REVIEW_REQUESTED]: {
    color: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
    progress: 85,
  },
  [ProjectStatus.COMPLETED]: {
    color: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    progress: 100,
  },
  [ProjectStatus.CANCELLED]: {
    color: "text-muted-foreground",
    bar: "bg-muted-foreground/60",
    progress: 0,
  },
  [ProjectStatus.DISPUTED]: {
    color: "text-orange-700 dark:text-orange-400",
    bar: "bg-orange-500",
    progress: 50,
  },
} as const;

const PROJECT_STATUS_KEYS = {
  [ProjectStatus.PENDING]: "pending",
  [ProjectStatus.OPEN]: "open",
  [ProjectStatus.IN_PROGRESS]: "inProgress",
  [ProjectStatus.REVIEW_REQUESTED]: "reviewRequested",
  [ProjectStatus.COMPLETED]: "completed",
  [ProjectStatus.CANCELLED]: "cancelled",
  [ProjectStatus.DISPUTED]: "disputed",
} as const;

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function getDueDateMeta(
  iso: string | null,
  t: (key: string, values?: Record<string, any>) => string,
  locale: string
): { text: string; className: string } {
  if (!iso) {
    return { text: t("noDeadline"), className: "text-muted-foreground" };
  }

  const date = new Date(iso);
  const days = Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0)
    return {
      text: t("overdue", { days: Math.abs(days) }),
      className: "text-destructive font-semibold",
    };
  if (days === 0)
    return { text: t("dueToday"), className: "text-destructive font-semibold" };
  if (days === 1)
    return {
      text: t("dueTomorrow"),
      className: "text-amber-600 dark:text-amber-400",
    };
  if (days <= 3)
    return {
      text: t("dueIn", { days }),
      className: "text-amber-600 dark:text-amber-400",
    };

  return {
    text: date.toLocaleDateString(locale === "ar" ? "ar" : "en-US", {
      month: "short",
      day: "numeric",
    }),
    className: "text-muted-foreground",
  };
}

function ParticipantAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-border shrink-0"
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

// ─── Submission Form ─────────────────────────────────────────────────────────

function SubmissionForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (note: string, url: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("projects.submissionForm");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const urlOk = url.trim() === "" || isHttpsUrl(url.trim());
  const isValid = note.trim().length >= 10 && urlOk;

  return (
    <div className="mt-4 p-4 rounded-xl bg-accent/70 border border-primary/20 space-y-3">
      <p className="text-xs font-semibold text-primary">{t("hint")}</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        rows={3}
        maxLength={500}
        className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
      />
      <div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("urlPlaceholder")}
          maxLength={500}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
        {!urlOk && (
          <p className="mt-1 text-[10px] text-destructive">{t("httpsOnly")}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {note.length}/500
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => isValid && onSubmit(note.trim(), url.trim())}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Revision Form ───────────────────────────────────────────────────────────

function RevisionForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (note: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("projects.revisionForm");
  const [note, setNote] = useState("");
  const isValid = note.trim().length >= 10;

  return (
    <div className="mt-4 p-4 rounded-xl bg-accent/70 border border-destructive/20 space-y-3">
      <p className="text-xs font-semibold text-destructive">{t("hint")}</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        rows={3}
        maxLength={500}
        className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-destructive focus:ring-1 focus:ring-destructive transition-all"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {note.length}/500
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => isValid && onSubmit(note.trim())}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {t("submit")}
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
  onRequestReview: (id: string, note: string, url: string) => void;
  onRequestRevision: (id: string, note: string) => void;
  pendingId: string | null;
}) {
  const t = useTranslations("projects.milestone");
  const tDue = useTranslations("projects.dueDate");
  const locale = useLocale();

  const [revisionOpen, setRevisionOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  const config = MILESTONE_STATUS_CLASSES[milestone.status];
  const statusLabel = t(`statuses.${MILESTONE_STATUS_KEYS[milestone.status]}`);
  const StatusIcon = config.icon;
  const due = getDueDateMeta(milestone.dueDate, tDue, locale);
  const isPending = pendingId === milestone.id;
  const isProjectActive = !(
    [
      ProjectStatus.COMPLETED,
      ProjectStatus.CANCELLED,
      ProjectStatus.DISPUTED,
    ] as ProjectStatus[]
  ).includes(projectStatus);

  const approvedDate = milestone.completedAt
    ? new Date(milestone.completedAt).toLocaleDateString(
        locale === "ar" ? "ar" : "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      )
    : "";

  return (
    <div className="flex gap-4 items-start">
      {/* Timeline indicator */}
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
                : "bg-accent"
            )}
            style={{ minHeight: "3rem" }}
          />
        )}
      </div>

      {/* Milestone card */}
      <div
        className={cn(
          "flex-1 mb-6 last:mb-0 rounded-2xl border overflow-hidden transition-all",
          milestone.status === MilestoneStatus.APPROVED
            ? "bg-card/60 border-emerald-500/15"
            : milestone.status === MilestoneStatus.REVIEW_REQUESTED
            ? "bg-card border-amber-500/20"
            : milestone.status === MilestoneStatus.REVISION_NEEDED
            ? "bg-card border-destructive/20"
            : milestone.status === MilestoneStatus.IN_PROGRESS
            ? "bg-card border-primary/20"
            : "bg-card border-border"
        )}
      >
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("label", { number: index + 1 })}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                    config.badge
                  )}
                >
                  <StatusIcon className="w-2.5 h-2.5" />
                  {statusLabel}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground leading-snug">
                {milestone.title}
              </h3>
            </div>

            {milestone.amount != null && (
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {t("value")}
                </p>
                <p className="text-lg font-black text-foreground leading-none">
                  ${milestone.amount}
                </p>
              </div>
            )}
          </div>

          {milestone.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {milestone.description}
            </p>
          )}

          {milestone.submissionNote && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15 mb-3">
              <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">
                  {t("deliveryNote")}
                </p>
                <p className="text-xs text-foreground/80">
                  {milestone.submissionNote}
                </p>
              </div>
            </div>
          )}
          {isHttpsUrl(milestone.submissionUrl) && (
            <a
              href={milestone.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mb-3 transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {t("viewDeliveryLink")}
            </a>
          )}

          {milestone.revisionNote &&
            milestone.status === MilestoneStatus.REVISION_NEEDED && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/15 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-0.5">
                    {t("revisionNote")}
                  </p>
                  <p className="text-xs text-destructive/90">
                    {milestone.revisionNote}
                  </p>
                </div>
              </div>
            )}

          {milestone.completedAt && (
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {t("approvedAt", { date: approvedDate })}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={cn("text-xs", due.className)}>{due.text}</span>
          </div>
        </div>

        {/* Action strip */}
        {isProjectActive && (
          <div className="border-t border-border/80 px-5 py-3 bg-accent/20">
            {isCreator && (
              <div className="flex items-center gap-2 flex-wrap">
                {milestone.status === MilestoneStatus.PENDING && (
                  <button
                    onClick={() => onStart(milestone.id)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    {t("actions.start")}
                  </button>
                )}

                {(milestone.status === MilestoneStatus.IN_PROGRESS ||
                  milestone.status === MilestoneStatus.REVISION_NEEDED) &&
                  !submissionOpen && (
                    <button
                      onClick={() => setSubmissionOpen(true)}
                      disabled={isPending}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                        "bg-amber-500 hover:bg-amber-400 text-amber-950",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {t("actions.submitForReview")}
                    </button>
                  )}

                {milestone.status === MilestoneStatus.REVIEW_REQUESTED && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {t("actions.awaitingReview")}
                  </p>
                )}

                {milestone.status === MilestoneStatus.APPROVED && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("actions.approvedMsg")}
                  </p>
                )}
              </div>
            )}

            {isClient && (
              <div className="flex items-center gap-2 flex-wrap">
                {milestone.status === MilestoneStatus.REVIEW_REQUESTED &&
                  !revisionOpen && (
                    <button
                      disabled={isPending}
                      onClick={() => setRevisionOpen(true)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                        "bg-accent hover:bg-destructive/10 border border-border hover:border-destructive/30",
                        "text-muted-foreground hover:text-destructive",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Flag className="w-3.5 h-3.5" />
                      )}
                      {t("actions.requestRevision")}
                    </button>
                  )}

                {milestone.status === MilestoneStatus.IN_PROGRESS && (
                  <p className="text-xs text-primary flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    {t("actions.creatorWorking")}
                  </p>
                )}

                {milestone.status === MilestoneStatus.PENDING && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {t("actions.notStarted")}
                  </p>
                )}

                {milestone.status === MilestoneStatus.APPROVED && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("actions.youApproved")}
                  </p>
                )}
              </div>
            )}

            {isCreator && submissionOpen && (
              <SubmissionForm
                isPending={isPending}
                onCancel={() => setSubmissionOpen(false)}
                onSubmit={(note, url) => {
                  setSubmissionOpen(false);
                  onRequestReview(milestone.id, note, url);
                }}
              />
            )}

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
  const t = useTranslations("projects.view");
  const tStatus = useTranslations("projects.statuses");
  const tDue = useTranslations("projects.dueDate");
  const locale = useLocale();

  const [isPending, startTransition] = useTransition();
  const [pendingMilestoneId, setPendingMilestoneId] = useState<string | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [localMilestones, setLocalMilestones] = useState<SerializedMilestone[]>(
    project.milestones
  );
  const [localProjectStatus, setLocalProjectStatus] = useState<ProjectStatus>(
    project.status
  );

  const statusClasses = PROJECT_STATUS_CLASSES[localProjectStatus];
  const statusLabel = tStatus(PROJECT_STATUS_KEYS[localProjectStatus]);
  const deadlineDue = getDueDateMeta(project.deadline, tDue, locale);

  const completedCount = useMemo(
    () =>
      localMilestones.filter((m) => m.status === MilestoneStatus.APPROVED)
        .length,
    [localMilestones]
  );

  const handleStartMilestone = useCallback(
    (milestoneId: string) => {
      if (isPending) return;
      setActionError(null);
      setPendingMilestoneId(milestoneId);

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
          setLocalMilestones(project.milestones);
          setLocalProjectStatus(project.status);
          setActionError(result.message ?? "Failed to start milestone.");
        }
      });
    },
    [isPending, localProjectStatus, project.milestones, project.status]
  );

  const handleRequestReview = useCallback(
    (milestoneId: string, note: string, url: string) => {
      if (isPending) return;
      setActionError(null);
      setPendingMilestoneId(milestoneId);

      const updatedMilestones = localMilestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              status: MilestoneStatus.REVIEW_REQUESTED,
              submissionNote: note,
              submissionUrl: url,
            }
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
        const result = await requestMilestoneReviewAction(milestoneId, note, url);
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

    setLocalMilestones((prev) =>
      prev.map((m) =>
        m.status === MilestoneStatus.REVIEW_REQUESTED
          ? {
              ...m,
              status: MilestoneStatus.APPROVED,
              completedAt: new Date().toISOString(),
            }
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

  const startedDate = new Date(project.createdAt).toLocaleDateString(
    locale === "ar" ? "ar" : "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Project Header */}
      <div className="border-b border-border bg-card/60 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard/projects"
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ChevronRight className="w-4 h-4 rotate-180 rtl:rotate-0" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground truncate">
                  {project.title}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("started", { date: startedDate })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                  localProjectStatus === ProjectStatus.COMPLETED
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : localProjectStatus === ProjectStatus.REVIEW_REQUESTED
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    : localProjectStatus === ProjectStatus.IN_PROGRESS
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-accent text-muted-foreground border-border"
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
                {statusLabel}
              </span>

              {project.chatRoom && (
                <Link
                  href={`/dashboard/chat/${project.chatRoom.id}`}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 border border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t("chat")}</span>
                  {project.chatRoom.messageCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {project.chatRoom.messageCount > 9
                        ? "9+"
                        : project.chatRoom.messageCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>
                {t("milestonesProgress", {
                  completed: completedCount,
                  total: localMilestones.length,
                })}
              </span>
              <span className={statusClasses.color}>
                {statusClasses.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  statusClasses.bar
                )}
                style={{ width: `${statusClasses.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global error */}
      {actionError && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="flex-1 text-sm text-destructive">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="text-destructive hover:text-destructive/80 transition-colors"
              aria-label={t("errorDismiss")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                {t("milestonesTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("done", {
                  completed: completedCount,
                  total: localMilestones.length,
                })}
              </span>
            </div>

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

            {isClient &&
              localProjectStatus === ProjectStatus.REVIEW_REQUESTED && (
                <div className="mt-6 p-6 rounded-2xl bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                    <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1.5">
                    {t("approveTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
                    {t("approveDesc")}
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
                      ? t("approving")
                      : t("approveBtn")}
                  </button>
                </div>
              )}

            {localProjectStatus === ProjectStatus.COMPLETED && (
              <div className="mt-6 p-6 rounded-2xl bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 text-center">
                <Award className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-foreground mb-1.5">
                  {t("completedTitle")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t("completedDesc")}
                </p>
              </div>
            )}
          </main>

          <aside className="w-full lg:w-72 xl:w-80 space-y-4 shrink-0">
            {project.service && (
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-accent/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("service")}
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {project.service.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("dayDelivery", {
                          days: project.service.deliveryDays,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {t("totalBudget")}
                    </span>
                    <span className="text-base font-black text-foreground">
                      ${project.budget ?? project.service.price}
                    </span>
                  </div>
                  <Link
                    href={`/marketplace/services/${project.service.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-accent hover:bg-accent/80 text-muted-foreground hover:text-foreground text-xs font-medium transition-all border border-border"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t("viewService")}
                  </Link>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-accent/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("participants")}
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    {t("client")}
                  </p>
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar name={project.client.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/profile/${project.client.id}`}
                        className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors block"
                      >
                        {project.client.name}
                      </Link>
                      {isClient && (
                        <span className="text-[10px] text-primary font-semibold">
                          {t("you")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-accent" />

                {project.creator ? (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                      {t("creator")}
                    </p>
                    <div className="flex items-center gap-3">
                      <ParticipantAvatar
                        name={project.creator.name}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/profile/${project.creator.id}`}
                          className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors block"
                        >
                          {project.creator.name}
                        </Link>
                        {project.creator.headline && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {project.creator.headline}
                          </p>
                        )}
                        {isCreator && (
                          <span className="text-[10px] text-primary font-semibold">
                            {t("you")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("noCreator")}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-accent/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("details")}
                </p>
              </div>
              <div className="p-4 space-y-3">
                {project.budget != null && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{t("budget")}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      ${project.budget}
                    </span>
                  </div>
                )}

                {project.deadline && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{t("deadline")}</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        deadlineDue.className
                      )}
                    >
                      {deadlineDue.text}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Flag className="w-3.5 h-3.5" />
                    <span>{t("status")}</span>
                  </div>
                  <span
                    className={cn("text-xs font-bold", statusClasses.color)}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {project.chatRoom && (
              <Link
                href={`/dashboard/chat/${project.chatRoom.id}`}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl",
                  "bg-primary/5 hover:bg-primary/10 border border-primary/15 hover:border-primary/25",
                  "transition-all group"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {t("projectChat")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("chatMessages", {
                      count: project.chatRoom.messageCount,
                    })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors rtl:rotate-180" />
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}