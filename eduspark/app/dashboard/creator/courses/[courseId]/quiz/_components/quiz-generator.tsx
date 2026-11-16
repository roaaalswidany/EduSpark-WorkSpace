/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle, PlusCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generateQuizDraftAction } from "@/actions/ai/generate-quiz";
import { createQuestionAction } from "@/actions/lms/create-question";

interface Props {
  courseId: string;
}

export function QuizGenerator({ courseId }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Tabs Header */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "ai" ? "text-indigo-400 border-b-2 border-emerald-400 bg-accent/50" : "text-muted-foreground hover:text-foreground200"
          }`}
        >
          <Sparkles className="w-4 h-4" /> AI Generation
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "manual" ? "text-indigo-400 border-b-2 border-emerald-400 bg-accent/50" : "text-muted-foreground hover:text-foreground200"
          }`}
        >
          <PlusCircle className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      <div className="p-5">
        {activeTab === "ai" ? (
          <AIGeneratorForm courseId={courseId} />
        ) : (
          <ManualQuestionForm courseId={courseId} onSuccess={() => {}} />
        )}
      </div>
    </div>
  );
}

// ─── AI Generator Form ────────────────────────────────────────────
function AIGeneratorForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">("INTERMEDIATE");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    if (isPending) return;
    setError(null);

    const toastId = toast.loading("Generating questions via AI...", { description: "This may take 10-20 seconds." });

    startTransition(async () => {
      const result = await generateQuizDraftAction({ courseId, questionCount, difficulty });

      if (!result.success) {
        const msg = result.error === "RATE_LIMITED" ? "AI is currently busy. Please try Manual Entry." : result.error;
        setError(msg);
        toast.error("Generation failed", { id: toastId, description: msg });
        return;
      }

      toast.success(`Generated ${result.draftedCount} questions!`, {
        id: toastId,
        description: "Draft questions created successfully.",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">Number of Questions</label>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            disabled={isPending}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          >
            {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as any)}
            disabled={isPending}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-primary hover:bg-primary/50 text-white disabled:opacity-50 transition-all"
      >
        {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
      </button>
    </div>
  );
}

// ─── Manual Form ──────────────────────────────────────────────────
function ManualQuestionForm({ courseId, onSuccess }: { courseId: string; onSuccess: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState("");
  const [explanation, setExplanation] = useState("");

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    if (correctOption === options[index] && value !== correctOption) {
      setCorrectOption(""); // reset if the correct option was edited
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!correctOption) {
      setError("Please select the correct answer.");
      return;
    }

    const toastId = toast.loading("Saving question...");

    startTransition(async () => {
      const result = await createQuestionAction({
        courseId,
        text,
        options,
        correctOption,
        explanation,
      });

      if (!result.success) {
        const friendly: Record<string, string> = {
          COURSE_LOCKED:
            "This course is no longer a draft, so its quiz is locked. Unpublish or withdraw it, edit the quiz, then submit it for review again.",
          RATE_LIMITED: "Too many questions in a short time. Please wait a few minutes.",
          FORBIDDEN: "You don't have permission to edit this quiz.",
        };
        setError(
          typeof result.error === "string"
            ? friendly[result.error] ?? result.error
            : "Failed to save question."
        );
        toast.error("Save failed", { id: toastId });
        return;
      }

      toast.success("Question added successfully!", { id: toastId });
      // Reset form
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectOption("");
      setExplanation("");
      router.refresh();
      onSuccess();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2">Question</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
          placeholder="Type your question here..."
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-muted-foreground">Options (Select the correct one)</label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correctOption"
              checked={correctOption === opt && opt !== ""}
              onChange={() => setCorrectOption(opt)}
              className="w-4 h-4 text-emerald-600 bg-background border-border focus:ring-emerald-500"
              required
            />
            <input
              type="text"
              value={opt}
              onChange={(e) => handleOptionChange(i, e.target.value)}
              required
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              placeholder={`Option ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2">Explanation</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          required
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
          placeholder="Why is this the correct answer?"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !text || !correctOption}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all"
      >
        {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-4 h-4" /> Save Question</>}
      </button>
    </form>
  );
}