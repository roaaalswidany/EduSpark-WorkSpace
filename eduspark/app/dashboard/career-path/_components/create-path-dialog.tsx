"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateCareerPathAction } from "@/actions/career-path/generate-path";

interface CreatePathDialogProps {
  onClose: () => void;
}

const EXAMPLE_GOALS = [
  "أريد أن أصبح Full-Stack Developer",
  "أريد تعلم تحليل البيانات",
  "أريد أن أصبح UI/UX Designer",
  "أريد تعلم تطوير تطبيقات الجوال",
];

export function CreatePathDialog({ onClose }: CreatePathDialogProps) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isValid = goal.trim().length >= 5;

  const handleGenerate = () => {
    if (!isValid || isPending) return;
    setError(null);

    const toastId = toast.loading("Generating your career path…", {
      description: "This may take 10-20 seconds.",
    });

    startTransition(async () => {
      const result = await generateCareerPathAction({
        goal: goal.trim(),
        preferredLanguage: "ar",
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          GEMINI_NOT_CONFIGURED: "AI service is not configured.",
          RATE_LIMITED: "AI is busy. Please try again in a moment.",
          NO_COURSES_AVAILABLE: "No courses available to build a path.",
          INVALID_INPUT: "Please enter a valid goal.",
          AI_ERROR: "Could not generate path. Please try again.",
        };
        const errorMessage = messages[result.error] ?? "Something went wrong.";

        setError(errorMessage);
        toast.error("Generation failed", {
          id: toastId,
          description: errorMessage,
        });
        return;
      }

      toast.success("Career path generated! 🎯", {
        id: toastId,
        description: "Your personalized path is ready.",
      });
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={isPending ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">
              Create Your Career Path
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Our AI will design a personalized learning journey for you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="goal"
              className="block text-sm font-semibold text-slate-300 mb-2"
            >
              What is your career goal?
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. أريد أن أصبح Full-Stack Developer متخصص في Next.js"
              rows={3}
              maxLength={200}
              disabled={isPending}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-600 mt-1.5">
              {goal.length}/200
            </p>
          </div>

          {/* Examples */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Examples
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setGoal(ex)}
                  disabled={isPending}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs",
                    "bg-slate-800 text-slate-300 border border-slate-700",
                    "hover:bg-slate-700 hover:text-white transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              isValid && !isPending
                ? "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-lg shadow-indigo-500/20"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Path
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}