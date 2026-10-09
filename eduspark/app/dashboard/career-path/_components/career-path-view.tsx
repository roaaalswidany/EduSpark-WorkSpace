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
          <div className="rounded-3xl bg-linear-to-br from-indigo-500/5 via-slate-900 to-violet-500/5 border border-slate-800 p-8 sm:p-16 text-center">
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-linear-to-br from-indigo-500 to-violet-600 mb-6 shadow-2xl shadow-indigo-500/20">
              <Target className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Build Your Career Path
            </h1>
            <p className="text-sm text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
              Tell us your career goal, and our AI will design a personalized
              learning journey with curated courses, milestones, and a clear
              timeline.
            </p>

            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                "bg-indigo-600 hover:bg-indigo-500 text-white",
                "text-sm font-bold transition-all active:scale-95",
                "shadow-lg shadow-indigo-500/30"
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
                color="text-indigo-400"
              />
              <Feature
                icon={TrendingUp}
                title="Track Progress"
                desc="Mark steps complete and watch your journey unfold"
                color="text-emerald-400"
              />
              <Feature
                icon={Clock}
                title="Realistic Timeline"
                desc="Weekly estimates based on industry standards"
                color="text-amber-400"
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
    BEGINNER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    INTERMEDIATE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ADVANCED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const levelClass =
    LEVEL_BADGE[activePath.level] ?? LEVEL_BADGE.BEGINNER;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <Target className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Career Path</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
          {activePath.goal}
        </h1>
        {activePath.description && (
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            {activePath.description}
          </p>
        )}

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
              levelClass
            )}
          >
            {activePath.level}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-2.5 h-2.5" />
            {activePath.estimatedWeeks} weeks
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            {totalSteps} steps
          </span>
        </div>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Progress
          </p>
          <p className="text-sm font-black text-white tabular-nums">
            {progressPct}%
          </p>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {completedSteps} of {totalSteps} steps completed
        </p>
      </div>

      {/* New path button */}
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
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
    <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
      <Icon className={cn("w-4 h-4 mb-2", color)} />
      <p className="text-xs font-bold text-white mb-1">{title}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}