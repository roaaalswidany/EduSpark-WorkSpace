/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createProjectReviewAction } from "@/actions/reviews/create-project-review";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  creatorName: string;
  onClose: () => void;
}

export function ProjectReviewForm({ projectId, creatorName, onClose }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (rating === 0) { setError("Please choose a rating."); return; }
    setError(null);
    const toastId = toast.loading("Submitting review…");
    startTransition(async () => {
      const res = await createProjectReviewAction({ projectId, rating, comment: comment.trim() || undefined });
      if (!res.success) {
        const msg = res.error === "ALREADY_REVIEWED" ? "You already reviewed this project." : "Could not submit review.";
        setError(msg); toast.error("Failed", { id: toastId, description: msg }); return;
      }
      toast.success("Review submitted! ⭐", { id: toastId });
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">Rate {creatorName}</h3>
          <p className="text-xs text-slate-400 mt-1">Share your experience working with this creator.</p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
              <Star className={cn("w-7 h-7 transition-colors", n <= rating ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-amber-400")} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1000} placeholder="How was the quality of work, communication, and delivery? (optional)" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-indigo-500" />
        {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || rating === 0} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}