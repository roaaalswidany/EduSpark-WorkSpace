"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  BookOpen,
  Zap,
  Award,
  Trophy,
  Crown,
  Store,
  TrendingUp,
  Star,
  MessageSquare,
  Flame,
  Target,
  CheckCircle2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_STYLES } from "@/lib/gamification/badges";

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Zap,
  Award,
  Trophy,
  Crown,
  Store,
  TrendingUp,
  Star,
  MessageSquare,
  Flame,
  Target,
  CheckCircle2,
};

interface BadgeData {
  id: string;
  key: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  tier: string;
  xpReward: number;
  earned: boolean;
}

interface BadgesGridProps {
  badges: BadgeData[];
}

export function BadgesGrid({ badges }: BadgesGridProps) {
  const t = useTranslations("achievements.badges");
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");

  const filtered = badges.filter((b) => {
    if (filter === "all") return true;
    if (filter === "earned") return b.earned;
    return !b.earned;
  });

  const earned = badges.filter((b) => b.earned).length;

  const filterLabels = {
    all: t("filterAll"),
    earned: t("filterEarned"),
    locked: t("filterLocked"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("unlocked", { earned, total: badges.length })}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
          {(["all", "earned", "locked"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === f
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeData }) {
  const locale = useLocale();
  const Icon = ICON_MAP[badge.icon] ?? Award;
  const tier =
    TIER_STYLES[badge.tier as keyof typeof TIER_STYLES] ?? TIER_STYLES.COMMON;

  // Locale-aware name & description from DB
  const displayName = locale === "ar" ? badge.nameAr : badge.name;
  const displayDesc =
    locale === "ar" ? badge.descriptionAr : badge.description;

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4 transition-all flex flex-col",
        badge.earned
          ? cn(tier.border, tier.bg, "hover:scale-[1.02] shadow-sm")
          : "border-border bg-card/50 opacity-60 grayscale-50"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl mb-3 mx-auto shrink-0",
          badge.earned
            ? cn("bg-linear-to-br shadow-lg", tier.gradient)
            : "bg-accent"
        )}
      >
        {badge.earned ? (
          <Icon className="w-6 h-6 text-white drop-shadow-md" />
        ) : (
          <Lock className="w-5 h-5 text-muted-foreground/70" />
        )}
      </div>

      <p
        className={cn(
          "text-sm font-bold text-center mb-1 line-clamp-1 flex-1",
          badge.earned ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {displayName}
      </p>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed line-clamp-2 mb-3">
        {displayDesc}
      </p>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/60">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider",
            badge.earned ? "text-foreground/70" : "text-muted-foreground/70"
          )}
        >
          {badge.tier}
        </span>
        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
          +{badge.xpReward} XP
        </span>
      </div>
    </div>
  );
}