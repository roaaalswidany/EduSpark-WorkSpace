"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createProjectReviewAction } from "@/actions/reviews/create-project-review";

const ERRORS: Record<string, string> = {
  ALREADY_REVIEWED: "You have already reviewed this project.",
  NOT_COMPLETED: "You can review a project once it is completed.",
  FORBIDDEN: "Only the client of this project can review it.",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  EMAIL_NOT_VERIFIED: "Please confirm your email address first.",
};

export function ReviewForm({ projectId, creatorName }: { projectId: string; creatorName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProjectReviewAction({ projectId, rating, comment });
      if (res.success) router.refresh();
      else setError(res.message ?? ERRORS[res.error] ?? "Something went wrong. Please try again.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-base font-semibold text-slate-100">How was working with {creatorName}?</h3>
      <p className="mt-1 text-sm text-slate-400">
        Your review is public and cannot be edited afterwards.
      </p>

      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            disabled={isPending}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="p-1 disabled:opacity-50"
          >
            <Star className={`h-7 w-7 transition-colors ${i <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={isPending}
        maxLength={1000}
        rows={4}
        placeholder="Share details that help other clients (optional)"
        className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      />
      <div className="mt-1 text-right text-xs text-slate-600">{comment.length}/1000</div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={isPending || rating === 0}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}
