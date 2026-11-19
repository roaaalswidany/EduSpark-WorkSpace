import Link from "next/link";
import { Crown, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevelForXP } from "@/lib/gamification/levels";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  level: string;
  isCurrentUser: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">Leaderboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top 20 learners this season
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 p-4 bg-linear-to-b from-amber-500/5 to-transparent border-b border-border">
            <PodiumCard entry={entries[1]} position={2} />
            <PodiumCard entry={entries[0]} position={1} />
            <PodiumCard entry={entries[2]} position={3} />
          </div>
        )}

        <div className="divide-y divide-border">
          {entries.slice(3).map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
}) {
  if (!entry) return <div />;

  const level = getLevelForXP(entry.xp);
  const xpFormatted = entry.xp.toLocaleString("en-US");

  const config = {
    1: {
      icon: Crown,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/30",
      size: "w-14 h-14",
    },
    2: {
      icon: Trophy,
      color: "text-foreground",
      bg: "bg-muted/10",
      border: "border-border/30",
      size: "w-12 h-12",
    },
    3: {
      icon: Medal,
      color: "text-amber-600",
      bg: "bg-amber-600/10",
      border: "border-amber-600/30",
      size: "w-12 h-12",
    },
  }[position];

  const Icon = config.icon;
  
  const initials = entry.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = entry.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <Link
      href={`/profile/${entry.userId}`}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105",
        config.bg,
        config.border,
        entry.isCurrentUser && "ring-2 ring-emerald-500/40"
      )}
    >
      <Icon className={cn("w-5 h-5", config.color)} />

      <div
        className={cn(
          "rounded-full ring-2 ring-border shrink-0 flex items-center justify-center text-white font-bold",
          config.size
        )}
        style={{ background: `hsl(${hue}, 55%, 42%)` }}
      >
        {initials}
      </div>

      <div className="text-center min-w-0 w-full">
        <p className="text-xs font-bold text-foreground truncate">
          {entry.name.split(" ")[0]}
        </p>
        <p className={cn("text-[10px] font-bold tabular-nums", level.color)}>
          {xpFormatted} XP
        </p>
      </div>
    </Link>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const level = getLevelForXP(entry.xp);
  const xpFormatted = entry.xp.toLocaleString("en-US");
  
  const initials = entry.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = entry.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <Link
      href={`/profile/${entry.userId}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        entry.isCurrentUser
          ? "bg-primary/10 hover:bg-primary/15"
          : "hover:bg-accent/40"
      )}
    >
      <div className="w-8 text-center shrink-0">
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          #{entry.rank}
        </span>
      </div>

      <div 
        className="w-9 h-9 rounded-full ring-2 ring-border flex items-center justify-center text-foreground text-xs font-bold shrink-0"
        style={{ background: `hsl(${hue}, 55%, 42%)` }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {entry.name}
          {entry.isCurrentUser && (
            <span className="ml-2 text-[10px] font-bold text-primary">
              (you)
            </span>
          )}
        </p>
        <p className={cn("text-[10px] font-bold", level.color)}>
          {level.icon} {level.label}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-black text-foreground tabular-nums">
          {xpFormatted}
        </p>
        <p className="text-[9px] text-muted-foreground/70 uppercase tracking-widest">
          XP
        </p>
      </div>
    </Link>
  );
}