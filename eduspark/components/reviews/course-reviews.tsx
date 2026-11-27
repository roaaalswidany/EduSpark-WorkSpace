"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  needsProgress?: boolean;
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={cn(
              "w-6 h-6 transition-colors",
              n <= value
                ? "text-amber-600 dark:text-amber-400 fill-amber-400"
                : "text-muted-foreground/70 hover:text-amber-600 dark:hover:text-amber-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  courseId,
  onDone,
}: {
  courseId: string;
  onDone: () => void;
}) {
  const t = useTranslations("reviews.course.form");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (rating === 0) {
      setError(t("chooseRating"));
      return;
    }
    setError(null);
    const toastId = toast.loading(t("submittingToast"));
    startTransition(async () => {
      const res = await createCourseReviewAction({
        courseId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (!res.success) {
        const errorMap: Record<string, string> = {
          ALREADY_REVIEWED: t("errors.alreadyReviewed"),
          NOT_ENROLLED: t("errors.notEnrolled"),
          NOT_ENOUGH_PROGRESS: t("errors.notEnoughProgress"),
          RATE_LIMITED: t("errors.rateLimited"),
          OWN_COURSE: t("errors.ownCourse"),
        };
        const msg = errorMap[res.error] ?? t("errors.generic");
        setError(msg);
        toast.error(t("failedToast"), { id: toastId, description: msg });
        return;
      }
      toast.success(t("successToast"), { id: toastId });
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <h3 className="text-sm font-bold text-foreground">{t("leaveReview")}</h3>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("commentPlaceholder")}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
      />
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-sm font-semibold disabled:opacity-50"
        >
          {t("cancel")}
        </button>
        <button
          onClick={submit}
          disabled={isPending || rating === 0}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Star className="w-4 h-4" />
          )}
          {t("submit")}
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
  const t = useTranslations("reviews.course");
  const locale = useLocale();
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="rounded-2xl bg-card border border-border p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {t("title", { count: ratingCount })}
        </h2>
        {ratingCount > 0 && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-foreground">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">/ 5</span>
          </div>
        )}
      </div>

      {canReview && !alreadyReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/80 text-foreground transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {t("writeReview")}
        </button>
      )}

      {alreadyReviewed && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          ✓ {t("alreadyReviewed")}
        </p>
      )}

      {needsProgress && !alreadyReviewed && (
        <p className="text-xs text-muted-foreground">{t("needsProgress")}</p>
      )}

      {showForm && (
        <ReviewForm courseId={courseId} onDone={() => setShowForm(false)} />
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {t("noReviews")}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-xl bg-background/40 border border-border p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">
                  {r.user.name}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "w-3.5 h-3.5",
                        n <= r.rating
                          ? "text-amber-600 dark:text-amber-400 fill-amber-400"
                          : "text-muted-foreground/70"
                      )}
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {r.comment}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-2">
                {new Date(r.createdAt).toLocaleDateString(
                  locale === "ar" ? "ar" : "en-US",
                  { month: "short", day: "numeric", year: "numeric" }
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}