"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  const t = useTranslations("reviews.starRating");

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={t("aria", { value })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-600 dark:text-amber-400"
              : "text-muted-foreground/70"
          }
        />
      ))}
    </span>
  );
}