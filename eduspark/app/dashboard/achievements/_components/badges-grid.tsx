"use client";

import { useState } from "react";
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
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");

  const filtered = badges.filter((b) => {
    if (filter === "all") return true;
    if (filter === "earned") return b.earned;
    return !b.earned;
  });

  const earned = badges.filter((b) => b.earned).length;

  return (
    <div>
      {/* Header + filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Badges</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {earned} of {badges.length} unlocked
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
              {f === "all" ? "All" : f === "earned" ? "Earned" : "Locked"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No badges match this filter.
          </p>
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeData }) {
  const Icon = ICON_MAP[badge.icon] ?? Award;
  const tier = TIER_STYLES[badge.tier as keyof typeof TIER_STYLES] ?? TIER_STYLES.COMMON;

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4 transition-all flex flex-col",
        badge.earned
          ? cn(tier.border, tier.bg, "hover:scale-[1.02] shadow-sm")
          : "border-border bg-card/50 opacity-60 grayscale-50"
      )}
    >
      {/* Icon */}
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

      {/* Name */}
      <p
        className={cn(
          "text-sm font-bold text-center mb-1 line-clamp-1 flex-1",
          
          badge.earned ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {badge.nameAr}
      </p>

      {/* Description */}
      <p className="text-[10px] text-muted-foreground text-center leading-relaxed line-clamp-2 mb-3">
        {badge.descriptionAr}
      </p>

      {/* Tier + XP */}
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