// eduspark/lib/gamification/levels.ts

export const LEVELS = [
  {
    key: "BRONZE",
    label: "Bronze",
    labelAr: "برونزي",
    minXP: 0,
    maxXP: 499,
    color: "text-amber-600",
    bg: "bg-amber-600/10",
    border: "border-amber-600/30",
    gradient: "from-amber-600 to-orange-700",
    icon: "🥉",
  },
  {
    key: "SILVER",
    label: "Silver",
    labelAr: "فضي",
    minXP: 500,
    maxXP: 1999,
    color: "text-slate-300",
    bg: "bg-slate-300/10",
    border: "border-slate-300/30",
    gradient: "from-slate-300 to-slate-500",
    icon: "🥈",
  },
  {
    key: "GOLD",
    label: "Gold",
    labelAr: "ذهبي",
    minXP: 2000,
    maxXP: 4999,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    gradient: "from-yellow-400 to-amber-600",
    icon: "🥇",
  },
  {
    key: "PLATINUM",
    label: "Platinum",
    labelAr: "بلاتيني",
    minXP: 5000,
    maxXP: 9999,
    color: "text-cyan-300",
    bg: "bg-cyan-300/10",
    border: "border-cyan-300/30",
    gradient: "from-cyan-300 to-blue-500",
    icon: "💎",
  },
  {
    key: "DIAMOND",
    label: "Diamond",
    labelAr: "ماسي",
    minXP: 10000,
    maxXP: Number.POSITIVE_INFINITY,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/30",
    gradient: "from-violet-400 to-fuchsia-600",
    icon: "👑",
  },
] as const;

export type LevelKey = (typeof LEVELS)[number]["key"];

export function getLevelForXP(xp: number): (typeof LEVELS)[number] {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(
  xp: number
): (typeof LEVELS)[number] | null {
  const current = getLevelForXP(xp);
  const idx = LEVELS.findIndex((l) => l.key === current.key);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export interface LevelProgress {
  current: (typeof LEVELS)[number];
  next: (typeof LEVELS)[number] | null;
  xpInLevel: number;
  xpToNext: number;
  progressPct: number;
}

export function getLevelProgress(xp: number): LevelProgress {
  const current = getLevelForXP(xp);
  const next = getNextLevel(xp);
  const xpInLevel = xp - current.minXP;
  const levelSpan = next ? next.minXP - current.minXP : 1;
  const xpToNext = next ? next.minXP - xp : 0;
  const progressPct = next
    ? Math.round((xpInLevel / levelSpan) * 100)
    : 100;

  return { current, next, xpInLevel, xpToNext, progressPct };
}