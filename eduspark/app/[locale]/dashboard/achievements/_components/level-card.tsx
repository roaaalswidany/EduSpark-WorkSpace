import { getTranslations, getLocale } from "next-intl/server";
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

export async function LevelCard({
  xp,
  levelProgress,
  badgesEarned,
  badgesTotal,
  userRank,
}: LevelCardProps) {
  const t = await getTranslations("achievements.levelCard");
  const locale = await getLocale();

  const { current, next, progressPct, xpToNext, xpInLevel } = levelProgress;

  const xpFormatted = xp.toLocaleString(locale === "ar" ? "ar" : "en-US");
  const xpToNextFormatted = xpToNext.toLocaleString(
    locale === "ar" ? "ar" : "en-US"
  );
  const xpInLevelFormatted = xpInLevel.toLocaleString(
    locale === "ar" ? "ar" : "en-US"
  );
  const levelSpanFormatted = next
    ? (next.minXP - current.minXP).toLocaleString(
        locale === "ar" ? "ar" : "en-US"
      )
    : "0";

  // Locale-aware level names
  const currentLabel =
    locale === "ar" && current.labelAr ? current.labelAr : current.label;
  const nextLabel = next
    ? locale === "ar" && next.labelAr
      ? next.labelAr
      : next.label
    : null;

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
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("currentLevel")}
              </p>
              <p className={cn("text-2xl font-black", current.color)}>
                {currentLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("xpSuffix")}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("rank")}
            </p>
            <p className="text-2xl font-black text-foreground tabular-nums">
              #{userRank || "—"}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-bold text-foreground tabular-nums">
                {xpFormatted} {t("xpSuffix")}
              </span>
            </div>
            {next && nextLabel && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("toNext", { xp: xpToNextFormatted, next: nextLabel })}
              </p>
            )}
          </div>
          <div className="h-2 rounded-full bg-background/60 overflow-hidden">
            <div
              className={cn(
                "h-full bg-linear-to-r transition-all duration-700",
                current.gradient
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {next && (
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {t("inLevel", {
                xp: xpInLevelFormatted,
                span: levelSpanFormatted,
              })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatBox
            icon={Trophy}
            label={t("badges")}
            value={`${badgesEarned}/${badgesTotal}`}
            color="text-amber-600 dark:text-amber-400"
          />
          <StatBox
            icon={Target}
            label={t("progress")}
            value={`${progressPct}%`}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <StatBox
            icon={TrendingUp}
            label={t("nextLevel")}
            value={nextLabel ?? t("max")}
            color="text-primary"
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
    <div className="rounded-xl bg-background/60 border border-border p-3">
      <Icon className={cn("w-4 h-4 mb-1.5", color)} />
      <p className="text-lg font-black text-foreground tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-1">
        {label}
      </p>
    </div>
  );
}