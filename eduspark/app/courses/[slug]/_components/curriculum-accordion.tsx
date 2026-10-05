/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import {
  ChevronDown,
  Play,
  Lock,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CurriculumLesson {
  id: string;
  title: string;
  duration: number | null;
  isFree: boolean;
}

export interface CurriculumSection {
  id: string;
  title: string;
  order: number;
  lessons: CurriculumLesson[];
}

interface CurriculumAccordionProps {
  sections: CurriculumSection[];
  totalLessons: number;
  totalDuration: number;
  isEnrolled: boolean;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CurriculumAccordion({
  sections,
  totalLessons,
  totalDuration,
  isEnrolled,
}: CurriculumAccordionProps) {
  // First section open by default, rest closed
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(sections[0] ? [sections[0].id] : [])
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white">Course Curriculum</h2>
        </div>
        <p className="text-xs text-slate-500">
          {sections.length} sections · {totalLessons} lessons ·{" "}
          {formatDuration(totalDuration)} total
        </p>
      </div>

      {/* Sections */}
      <div>
        {sections.map((section, idx) => {
          const isOpen = expanded.has(section.id);
          const sectionDuration = section.lessons.reduce(
            (sum, l) => sum + (l.duration ?? 0),
            0
          );

          return (
            <div
              key={section.id}
              className="border-b border-slate-800/60 last:border-0"
            >
              {/* Section header */}
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-3 px-5 sm:px-6 py-4 hover:bg-slate-800/30 transition-colors text-left group"
              >
                {/* Section number */}
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-slate-700 transition-colors">
                  {idx + 1}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                    {section.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {section.lessons.length}{" "}
                    {section.lessons.length === 1 ? "lesson" : "lessons"}
                    {sectionDuration > 0 && ` · ${formatDuration(sectionDuration)}`}
                  </p>
                </div>

                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-slate-600 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Lessons */}
              {isOpen && (
                <div className="pb-2">
                  {section.lessons.map((lesson) => {
                    const locked = !isEnrolled && !lesson.isFree;
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "flex items-center gap-3 px-5 sm:px-6 py-2.5 pl-14 sm:pl-16",
                          "hover:bg-slate-800/30 transition-colors"
                        )}
                      >
                        {/* Icon */}
                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-indigo-400 shrink-0 fill-current" />
                        )}

                        {/* Title */}
                        <span
                          className={cn(
                            "flex-1 text-xs truncate",
                            locked ? "text-slate-500" : "text-slate-300"
                          )}
                        >
                          {lesson.title}
                        </span>

                        {/* Free badge */}
                        {!isEnrolled && lesson.isFree && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">
                            Free
                          </span>
                        )}

                        {/* Duration */}
                        {lesson.duration != null && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-600 shrink-0 tabular-nums">
                            <Clock className="w-3 h-3" />
                            {formatDuration(lesson.duration)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}