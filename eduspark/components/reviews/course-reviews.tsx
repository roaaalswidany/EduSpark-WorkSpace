"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createCourseReviewAction } from "@/actions/reviews/create-course-review";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; name: string; image: string | null };
}

interface Props {
  courseId: string;
  reviews: ReviewItem[];
  averageRating: number;
  ratingCount: number;
  canReview: boolean;
  alreadyReviewed: boolean;
  /** Enrolled, but not far enough into the course to rate it yet. */
  needsProgress?: boolean;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
          <Star
            className={cn(
              "w-6 h-6 transition-colors",
              n <= value ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-amber-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (rating === 0) { setError("Please choose a rating."); return; }
    setError(null);
    const toastId = toast.loading("Submitting review…");
    startTransition(async () => {
      const res = await createCourseReviewAction({
        courseId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (!res.success) {
        const msg =
          res.error === "ALREADY_REVIEWED"
            ? "You already reviewed this course."
            : res.error === "NOT_ENROLLED"
            ? "You must be enrolled to review."
            : res.error === "NOT_ENOUGH_PROGRESS"
            ? "Complete a bit more of the course before reviewing it."
            : res.error === "RATE_LIMITED"
            ? "Too many reviews in a short time. Please try again later."
            : res.error === "OWN_COURSE"
            ? "You cannot review your own course."
            : "Could not submit review.";
        setError(msg);
        toast.error("Failed", { id: toastId, description: msg });
        return;
      }
      toast.success("Review submitted! ⭐", { id: toastId });
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
      <h3 className="text-sm font-bold text-white">Leave a review</h3>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Share your experience (optional)"
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
      />
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={isPending || rating === 0}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
          Submit
        </button>
      </div>
    </div>
  );
}

export function CourseReviews({
  courseId,
  reviews,
  averageRating,
  ratingCount,
  canReview,
  alreadyReviewed,
  needsProgress = false,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Reviews ({ratingCount})</h2>
        {ratingCount > 0 && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-white">{averageRating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">/ 5</span>
          </div>
        )}
      </div>

      {canReview && !alreadyReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <MessageSquare className="w-4 h-4" /> Write a review
        </button>
      )}

      {alreadyReviewed && (
        <p className="text-xs text-emerald-400">✓ You have already reviewed this course.</p>
      )}

      {needsProgress && !alreadyReviewed && (
        <p className="text-xs text-slate-500">
          You can review this course after completing a part of it.
        </p>
      )}

      {showForm && <ReviewForm courseId={courseId} onDone={() => setShowForm(false)} />}

      {reviews.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-200">{r.user.name}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "w-3.5 h-3.5",
                        n <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-700"
                      )}
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-slate-400 leading-relaxed">{r.comment}</p>
              )}
              <p className="text-[10px] text-slate-600 mt-2">
                {new Date(r.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}