import { getTranslations, getLocale } from "next-intl/server";
import { getServiceRating, getServiceReviews } from "@/lib/reviews/reputation";
import { StarRating } from "./star-rating";

export async function ServiceReviews({ serviceId }: { serviceId: string }) {
  const t = await getTranslations("reviews.service");
  const locale = await getLocale();

  const [summary, reviews] = await Promise.all([
    getServiceRating(serviceId),
    getServiceReviews(serviceId, 10),
  ]);

  return (
    <section
      id="reviews"
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        {summary.average !== null && (
          <div className="flex items-center gap-2">
            <StarRating value={summary.average} />
            <span className="text-sm font-semibold text-foreground">
              {summary.average.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              ({summary.count})
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("noReviews")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <StarRating value={r.rating} size={14} />
                <span className="text-sm text-foreground">
                  {r.reviewer.name}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {r.createdAt.toLocaleDateString(
                    locale === "ar" ? "ar" : "en-GB",
                    { timeZone: "UTC" }
                  )}
                </span>
              </div>
              {r.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {r.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}