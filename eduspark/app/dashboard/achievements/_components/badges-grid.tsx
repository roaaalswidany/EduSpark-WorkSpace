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
          <h2 className="text-lg font-bold text-white">Badges</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {earned} of {badges.length} unlocked
          </p>
        </div>

        <div className="flex items-center gap-1">
          {(["all", "earned", "locked"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === f
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
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
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <p className="text-sm text-slate-500">
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
        "relative rounded-2xl border p-4 transition-all",
        badge.earned
          ? cn(tier.border, tier.bg, "hover:scale-[1.02]")
          : "border-slate-800 bg-slate-900/50 opacity-60"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl mb-3 mx-auto",
          badge.earned
            ? cn("bg-linear-to-br shadow-lg", tier.gradient)
            : "bg-slate-800"
        )}
      >
        {badge.earned ? (
          <Icon className="w-6 h-6 text-white" />
        ) : (
          <Lock className="w-5 h-5 text-slate-600" />
        )}
      </div>

      {/* Name */}
      <p
        className={cn(
          "text-sm font-bold text-center mb-1 line-clamp-1",
          badge.earned ? "text-white" : "text-slate-500"
        )}
      >
        {badge.nameAr}
      </p>

      {/* Description */}
      <p className="text-[10px] text-slate-500 text-center leading-relaxed line-clamp-2">
        {badge.descriptionAr}
      </p>

      {/* Tier + XP */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider",
            badge.earned ? tier.color : "text-slate-600"
          )}
        >
          {badge.tier}
        </span>
        <span className="text-[9px] font-bold text-amber-500/70 tabular-nums">
          +{badge.xpReward} XP
        </span>
      </div>
    </div>
  );
}