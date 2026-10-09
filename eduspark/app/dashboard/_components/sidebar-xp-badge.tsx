"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarXpBadgeProps {
  xp: number;
  levelLabel: string;
  levelIcon: string;
  levelColor: string;
  levelBg: string;
  levelBorder: string;
  levelGradient: string;
  progressPct: number;
  xpToNext: number;
  nextLevelLabel: string | null;
  onNavigate?: () => void;
}

export function SidebarXpBadge({
  xp,
  levelLabel,
  levelIcon,
  levelColor,
  levelBg,
  levelBorder,
  levelGradient,
  progressPct,
  xpToNext,
  nextLevelLabel,
  onNavigate,
}: SidebarXpBadgeProps) {
  // Format numbers consistently across SSR and client to avoid hydration mismatch
  const xpFormatted = xp.toLocaleString("en-US");
  const xpToNextFormatted = xpToNext.toLocaleString("en-US");

  return (
    <Link
      href="/dashboard/achievements"
      onClick={onNavigate}
      className={cn(
        "block rounded-xl border p-3 transition-all",
        "hover:border-indigo-500/40 hover:bg-slate-800/60",
        "group",
        levelBorder,
        levelBg
      )}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
            "bg-linear-to-br text-lg",
            levelGradient
          )}
        >
          <span>{levelIcon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn("text-xs font-bold truncate", levelColor)}>
              {levelLabel}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 tabular-nums">
            <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
            {xpFormatted} XP
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
          <div
            className={cn(
              "h-full bg-linear-to-r transition-all duration-500",
              levelGradient
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {nextLevelLabel && (
          <p className="text-[9px] text-slate-600 tabular-nums">
            {xpToNextFormatted} XP to {nextLevelLabel}
          </p>
        )}
        {!nextLevelLabel && (
          <p className="text-[9px] text-slate-600">Max level reached 👑</p>
        )}
      </div>
    </Link>
  );
}