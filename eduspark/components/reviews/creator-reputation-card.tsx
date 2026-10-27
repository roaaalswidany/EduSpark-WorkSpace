import { getCreatorCompletedProjects, getCreatorRating } from "@/lib/reviews/reputation";
import { StarRating } from "./star-rating";

export async function CreatorReputationCard({ creatorId }: { creatorId: string }) {
  const [rating, completed] = await Promise.all([getCreatorRating(creatorId), getCreatorCompletedProjects(creatorId)]);
  if (rating.count === 0 && completed === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Reputation</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="text-4xl font-bold text-slate-50">{rating.average?.toFixed(1) ?? "—"}</div>
          {rating.average !== null && <StarRating value={rating.average} size={18} />}
          <div className="mt-1 text-xs text-slate-500">
            {rating.count} review{rating.count === 1 ? "" : "s"} · {completed} completed project{completed === 1 ? "" : "s"}
          </div>
        </div>
        <ul className="space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((n) => {
            const pct = rating.count ? (rating.distribution[n] / rating.count) * 100 : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3">{n}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                  <div className="h-full rounded bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right">{rating.distribution[n]}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
