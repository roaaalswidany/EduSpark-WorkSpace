"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateCareerPathAction } from "@/actions/career-path/generate-path";
import { useLanguage } from "@/components/providers/language-provider";

interface CreatePathDialogProps {
  onClose: () => void;
}

export function CreatePathDialog({ onClose }: CreatePathDialogProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [goal, setGoal] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isValid = goal.trim().length >= 5;


  const exampleGoals = [
    t("exFullStack"),
    t("exDataAnalysis"),
    t("exUiUx"),
    t("exMobile"),
  ];

  const handleClose = () => {
    if (isPending) {
      toast.info(t("bgGenerationTitle"), {
        description: t("bgGenerationDesc"),
      });
    }
    onClose();
  };

  const handleGenerate = () => {
    if (!isValid || isPending) return;
    setError(null);

    const toastId = toast.loading(t("generatingToast"), {
      description: t("generatingToastDesc"),
    });

    startTransition(async () => {
      const result = await generateCareerPathAction({
        goal: goal.trim(),
        preferredLanguage: locale,
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          GEMINI_NOT_CONFIGURED: "AI service is not configured.",
          RATE_LIMITED: "AI is busy. Please try again in a moment.",
          NO_COURSES_AVAILABLE: "No courses available to build a path.",
          INVALID_INPUT: "Please enter a valid goal.",
          AI_ERROR: "Could not generate path. Please try again.",
        };
        const errorMessage = messages[result.error] ?? t("errorPrefix");

        setError(errorMessage);
        toast.error(t("failedToast"), {
          id: toastId,
          description: errorMessage,
        });
        return;
      }

      toast.success(t("successToast"), {
        id: toastId,
        description: t("successToastDesc"),
      });
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground">
              {t("createPathTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("createPathDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="goal"
              className="block text-sm font-semibold text-foreground mb-2"
            >
              {t("careerGoalLabel")}
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("careerGoalPlaceholder")}
              rows={3}
              maxLength={200}
              disabled={isPending}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {goal.length}/200
            </p>
          </div>

          {/* Examples */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {t("examples")}
            </p>
            <div className="flex flex-wrap gap-2">
              {exampleGoals.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setGoal(ex)}
                  disabled={isPending}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs",
                    "bg-accent text-foreground border border-border",
                    "hover:bg-accent hover:text-accent-foreground transition-colors", // تم إصلاح hover:text-white
                    "disabled:opacity-50"
                  )}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-background/40">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            {isPending ? t("close") : t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              isValid && !isPending
                ? "bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 shadow-lg shadow-primary/20"
                : "bg-accent text-muted-foreground/70 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t("generatePath")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}