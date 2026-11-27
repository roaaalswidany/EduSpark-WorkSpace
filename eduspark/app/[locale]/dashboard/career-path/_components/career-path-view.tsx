"use client";

import { useState } from "react";
import { Sparkles, Target, Clock, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreatePathDialog } from "./create-path-dialog";
import { PathTimeline } from "./path-timeline";

interface SerializedPath {
  id: string;
  goal: string;
  level: string;
  description: string | null;
  estimatedWeeks: number;
  status: string;
  createdAt: string;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    description: string;
    estimatedWeeks: number;
    skills: string[];
    status: string;
    completedAt: string | null;
    course: {
      id: string;
      title: string;
      slug: string;
      level: string;
    } | null;
  }>;
}

interface CareerPathViewProps {
  activePath: SerializedPath | null;
}

export function CareerPathView({ activePath }: CareerPathViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // ─── Empty State ────────────────────────────────────────
  if (!activePath) {
    return (
      <>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="rounded-3xl bg-linear-to-br from-emerald-500/5 via-muted to-emerald-500/5 border border-border p-8 sm:p-16 text-center">
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-linear-to-br from-emerald-500 to-emerald-600 mb-6 shadow-2xl shadow-emerald-500/20">
              
              <Target className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              Build Your Career Path
            </h1>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              Tell us your career goal, and our AI will design a personalized
              learning journey with curated courses, milestones, and a clear
              timeline.
            </p>

            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                "text-sm font-bold transition-all active:scale-95",
                "shadow-lg shadow-emerald-500/30"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Create Your Path
            </button>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
              <Feature
                icon={Sparkles}
                title="AI-Powered"
                desc="Personalized path built on your goals and current level"
                color="text-primary"
              />
              <Feature
                icon={TrendingUp}
                title="Track Progress"
                desc="Mark steps complete and watch your journey unfold"
                color="text-emerald-500 dark:text-emerald-400"
              />
              <Feature
                icon={Clock}
                title="Realistic Timeline"
                desc="Weekly estimates based on industry standards"
                color="text-amber-600 dark:text-amber-400"
              />
            </div>
          </div>
        </div>

        {dialogOpen && (
          <CreatePathDialog onClose={() => setDialogOpen(false)} />
        )}
      </>
    );
  }

  // ─── Active Path ────────────────────────────────────────
  const completedSteps = activePath.steps.filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const totalSteps = activePath.steps.length;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  const LEVEL_BADGE: Record<string, string> = {
    BEGINNER: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    
    INTERMEDIATE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    ADVANCED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  };

  const levelClass =
    LEVEL_BADGE[activePath.level] ?? LEVEL_BADGE.BEGINNER;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <Target className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Career Path</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight leading-tight">
          {activePath.goal}
        </h1>
        {activePath.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {activePath.description}
          </p>
        )}

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
              levelClass
            )}
          >
            {activePath.level}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent/50 text-muted-foreground border border-border">
            <Clock className="w-2.5 h-2.5" />
            {activePath.estimatedWeeks} weeks
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent/50 text-muted-foreground border border-border">
            {totalSteps} steps
          </span>
        </div>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl bg-card border border-border p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Progress
          </p>
          <p className="text-sm font-black text-foreground tabular-nums">
            {progressPct}%
          </p>
        </div>
        <div className="h-2 rounded-full bg-accent overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {completedSteps} of {totalSteps} steps completed
        </p>
      </div>

      {/* New path button */}
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border",
            
            "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          New Path
        </button>
      </div>

      {/* Timeline */}
      <PathTimeline steps={activePath.steps} />

      {dialogOpen && (
        <CreatePathDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-4">
      <Icon className={cn("w-4 h-4 mb-2", color)} />
      <p className="text-xs font-bold text-foreground mb-1">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}