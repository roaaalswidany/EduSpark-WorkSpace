"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { createProjectReviewAction } from "@/actions/reviews/create-project-review";

export function ReviewForm({
  projectId,
  creatorName,
}: {
  projectId: string;
  creatorName: string;
}) {
  const t = useTranslations("reviews.project");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProjectReviewAction({
        projectId,
        rating,
        comment,
      });
      if (res.success) {
        router.refresh();
      } else {
        const errorMap: Record<string, string> = {
          ALREADY_REVIEWED: t("errors.alreadyReviewed"),
          NOT_COMPLETED: t("errors.notCompleted"),
          FORBIDDEN: t("errors.forbidden"),
          RATE_LIMITED: t("errors.rateLimited"),
          EMAIL_NOT_VERIFIED: t("errors.emailNotVerified"),
        };
        setError(errorMap[res.error] ?? res.message ?? t("errors.generic"));
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">
        {t("question", { creatorName })}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div
        className="mt-4 flex items-center gap-1"
        role="radiogroup"
        aria-label={t("ratingAria")}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={t("starAria", { count: i })}
            disabled={isPending}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="p-1 disabled:opacity-50"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                i <= (hover || rating)
                  ? "fill-amber-400 text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground/70"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={isPending}
        maxLength={1000}
        rows={4}
        placeholder={t("commentPlaceholder")}
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground/70">
        {comment.length}/1000
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={isPending || rating === 0}
        className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}