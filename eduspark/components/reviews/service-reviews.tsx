import { getServiceRating, getServiceReviews } from "@/lib/reviews/reputation";
import { StarRating } from "./star-rating";

export async function ServiceReviews({ serviceId }: { serviceId: string }) {
  const [summary, reviews] = await Promise.all([getServiceRating(serviceId), getServiceReviews(serviceId, 10)]);

  return (
    <section id="reviews" className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Client reviews</h2>
        {summary.average !== null && (
          <div className="flex items-center gap-2">
            <StarRating value={summary.average} />
            <span className="text-sm font-semibold text-slate-200">{summary.average.toFixed(1)}</span>
            <span className="text-sm text-slate-500">({summary.count})</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No reviews yet. Reviews appear after a client completes a project.</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-800">
          {reviews.map((r) => (
            <li key={r.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <StarRating value={r.rating} size={14} />
                <span className="text-sm text-slate-300">{r.reviewer.name}</span>
                <span className="text-xs text-slate-600">{r.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}</span>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
