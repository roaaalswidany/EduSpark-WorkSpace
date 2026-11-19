/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Play,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateStepStatusAction } from "@/actions/career-path/update-step-status";
import { useLanguage } from "@/components/providers/language-provider";

interface Step {
  id: string;
  order: number;
  title: string;
  description: string;
  estimatedWeeks: number;
  skills: string[];
  status: string;
  completedAt: string | null;
  course: {
    id: string;
    title: string;
    slug: string;
    level: string;
  } | null;
}

interface PathTimelineProps {
  steps: Step[];
}

export function PathTimeline({ steps }: PathTimelineProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [pendingStepId, setPendingStepId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleStatusChange = (step: Step, newStatus: string) => {
    setPendingStepId(step.id);

    const toastId = toast.loading(t("updatingProgress"));

    startTransition(async () => {
      const result = await updateStepStatusAction({
        stepId: step.id,
        status: newStatus as "PENDING" | "IN_PROGRESS" | "COMPLETED",
      });
      setPendingStepId(null);

      if (!result.success) {
        toast.error(t("updateFailed"), { id: toastId });
        return;
      }

      toast.success(
        newStatus === "COMPLETED"
          ? t("stepCompletedToast")
          : t("stepStartedToast"),
        { id: toastId }
      );
      router.refresh();
    });
  };

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-8 bottom-8 w-px bg-accent" />

      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isPending = pendingStepId === step.id;
          const isCompleted = step.status === "COMPLETED";
          const isInProgress = step.status === "IN_PROGRESS";

          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Status icon */}
              <div className="relative z-10 shrink-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500"
                      : isInProgress
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  )}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : isInProgress ? (
                    <Play className="w-4 h-4 text-primary-foreground fill-current" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                  )}
                </div>
              </div>

              {/* Card */}
              <div
                className={cn(
                  "flex-1 rounded-2xl border p-5 transition-all",
                  isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : isInProgress
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3
                    className={cn(
                      "text-sm font-bold",
                      isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                    )}
                  >
                    {step.title}
                  </h3>
                  <div className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                    <Clock className="w-3 h-3" />
                    {step.estimatedWeeks}{t("weeksShort")}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {step.description}
                </p>

                {/* Skills */}
                {step.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {step.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded-md bg-accent border border-border text-[10px] font-medium text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Course link */}
                {step.course && (
                  <Link
                    href={`/courses/${step.course.slug}`}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg mb-3",
                      "bg-background border border-border",
                      "hover:border-primary/40 transition-all group"
                    )}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-foreground truncate group-hover:text-foreground transition-colors">
                      {step.course.title}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/70 shrink-0">
                      {step.course.level.toLowerCase()}
                    </span>
                  </Link>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!isCompleted && !isInProgress && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(step, "IN_PROGRESS")}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {t("startBtn")}
                    </button>
                  )}
                  {isInProgress && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(step, "COMPLETED")}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {t("markCompleteBtn")}
                    </button>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      ✓ {t("completedLabel")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}