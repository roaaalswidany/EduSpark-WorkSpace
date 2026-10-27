import { db } from "@/lib/db";
import { StarRating } from "./star-rating";
import { ReviewForm } from "./review-form";

/** Server component: shows the review, or the form to the client of a COMPLETED project. */
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
  const review = await db.projectReview.findUnique({
    where: { projectId },
    select: { rating: true, comment: true, createdAt: true, reviewer: { select: { name: true } } },
  });

  if (review) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-base font-semibold text-slate-100">Client review</h3>
        <div className="mt-3 flex items-center gap-3">
          <StarRating value={review.rating} size={18} />
          <span className="text-sm text-slate-400">
            {review.reviewer.name} · {review.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}
          </span>
        </div>
        {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{review.comment}</p>}
      </section>
    );
  }

  if (isClient && status === "COMPLETED") {
    return <ReviewForm projectId={projectId} creatorName={creatorName} />;
  }
  return null;
}
