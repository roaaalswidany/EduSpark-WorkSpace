import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { StarRating } from "./star-rating";
import { ReviewForm } from "./review-form";

export async function ProjectReviewPanel({
  projectId,
  status,
  isClient,
  creatorName,
}: {
  projectId: string;
  status: string;
  isClient: boolean;
  creatorName: string;
}) {
  const t = await getTranslations("reviews.project");
  const locale = await getLocale();

  const review = await db.projectReview.findUnique({
    where: { projectId },
    select: {
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { name: true } },
    },
  });

  if (review) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">
          {t("clientReview")}
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <StarRating value={review.rating} size={18} />
          <span className="text-sm text-muted-foreground">
            {review.reviewer.name} ·{" "}
            {review.createdAt.toLocaleDateString(
              locale === "ar" ? "ar" : "en-GB",
              { timeZone: "UTC" }
            )}
          </span>
        </div>
        {review.comment && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {review.comment}
          </p>
        )}
      </section>
    );
  }

  if (isClient && status === "COMPLETED") {
    return <ReviewForm projectId={projectId} creatorName={creatorName} />;
  }
  return null;
}