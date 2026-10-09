import { Sparkles, Trophy, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LevelProgress } from "@/lib/gamification/levels";

interface LevelCardProps {
  xp: number;
  levelProgress: LevelProgress;
  badgesEarned: number;
  badgesTotal: number;
  userRank: number;
}

export function LevelCard({
  xp,
  levelProgress,
  badgesEarned,
  badgesTotal,
  userRank,
}: LevelCardProps) {
  const { current, next, progressPct, xpToNext, xpInLevel } = levelProgress;

  // Consistent number formatting to avoid hydration mismatch
  const xpFormatted = xp.toLocaleString("en-US");
  const xpToNextFormatted = xpToNext.toLocaleString("en-US");
  const xpInLevelFormatted = xpInLevel.toLocaleString("en-US");
  const levelSpanFormatted = next
    ? (next.minXP - current.minXP).toLocaleString("en-US")
    : "0";

  return (
    <div
      className={cn(
        "rounded-3xl border p-6 sm:p-8 overflow-hidden relative",
        current.border,
        current.bg
      )}
    >
      <div
        className={cn(
          "absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 bg-linear-to-br",
          current.gradient
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex items-center justify-center w-16 h-16 rounded-2xl text-3xl",
                "bg-linear-to-br shadow-lg",
                current.gradient
              )}
            >
              {current.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Current Level
              </p>
              <p className={cn("text-2xl font-black", current.color)}>
                {current.label}
              </p>
              <p className="text-xs text-slate-500">{current.labelAr}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Rank
            </p>
            <p className="text-2xl font-black text-white tabular-nums">
              #{userRank || "—"}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white tabular-nums">
                {xpFormatted} XP
              </span>
            </div>
            {next && (
              <p className="text-xs text-slate-500 tabular-nums">
                {xpToNextFormatted} to {next.label}
              </p>
            )}
          </div>
          <div className="h-2 rounded-full bg-slate-950/60 overflow-hidden">
            <div
              className={cn(
                "h-full bg-linear-to-r transition-all duration-700",
                current.gradient
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {next && (
            <p className="text-[10px] text-slate-600 mt-1.5">
              {xpInLevelFormatted} / {levelSpanFormatted} XP in this level
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatBox
            icon={Trophy}
            label="Badges"
            value={`${badgesEarned}/${badgesTotal}`}
            color="text-amber-400"
          />
          <StatBox
            icon={Target}
            label="Progress"
            value={`${progressPct}%`}
            color="text-emerald-400"
          />
          <StatBox
            icon={TrendingUp}
            label="Next Level"
            value={next ? next.label : "MAX"}
            color="text-indigo-400"
          />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
      <Icon className={cn("w-4 h-4 mb-1.5", color)} />
      <p className="text-lg font-black text-white tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
        {label}
      </p>
    </div>
  );
}