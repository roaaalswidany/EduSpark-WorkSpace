/* eslint-disable @typescript-eslint/no-unused-vars */
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Play,
  Award,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseLevel } from "@prisma/client";

export interface EnrolledCourse {
  enrollmentId: string;
  courseId: string;
  courseSlug: string;
  title: string;
  description: string;
  thumbnail: string | null;
  level: CourseLevel;
  category: { id: string; name: string; slug: string } | null;
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
  };
  totalLessons: number;
  totalDuration: number;
  progress: number;
  isPassed: boolean;
  enrolledAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
}

const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function EnrolledCourseCard({ course }: { course: EnrolledCourse }) {
  const isCompleted = course.isPassed;
  const progress = Math.min(100, Math.round(course.progress));

  return (
    <Link
      href={`/dashboard/student/courses/${course.courseId}`}
      className={cn(
        "group flex flex-col rounded-2xl bg-slate-900 border overflow-hidden",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        isCompleted
          ? "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/5"
          : "border-slate-800 hover:border-indigo-500/40 hover:shadow-indigo-500/5"
      )}
    >
      {/* ── Thumbnail ─────────────────────────────────────── */}
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-indigo-500/10 via-slate-900 to-violet-500/10">
            <BookOpen className="w-12 h-12 text-slate-700" />
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/95 via-slate-950/30 to-transparent" />

        {/* Status badge top-right */}
        <div className="absolute top-3 right-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
              <Award className="w-3 h-3" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
              <TrendingUp className="w-3 h-3" />
              In Progress
            </span>
          )}
        </div>

        {/* Level + Category bottom */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 backdrop-blur-sm bg-slate-950/60 px-2 py-1 rounded">
            {course.category?.name ?? LEVEL_LABELS[course.level]}
          </span>
          <span className="text-[10px] font-semibold text-slate-300 backdrop-blur-sm bg-slate-950/60 px-2 py-1 rounded tabular-nums">
            {progress}%
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
        {/* Title */}
        <h3 className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {course.title}
        </h3>

        {/* Instructor */}
        <div className="flex items-center gap-2">
          {course.creator.image ? (
            <Image
              src={course.creator.image}
              alt={course.creator.name}
              width={20}
              height={20}
              className="rounded-full object-cover ring-1 ring-slate-700"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-slate-700">
              {course.creator.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <span className="text-xs text-slate-500 truncate">
            {course.creator.name}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 mt-auto">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="text-slate-500">
              {isCompleted ? "All lessons completed" : "Your progress"}
            </span>
            <span
              className={cn(
                "tabular-nums",
                isCompleted ? "text-emerald-400" : "text-indigo-400"
              )}
            >
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCompleted
                  ? "bg-linear-to-r from-emerald-500 to-teal-400"
                  : "bg-linear-to-r from-indigo-500 to-violet-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {course.totalLessons} lessons
          </span>
          {course.totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(course.totalDuration)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {formatRelative(course.lastActivityAt)}
          </span>
        </div>

        {/* CTA */}
        <div
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            isCompleted
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/15"
              : "bg-indigo-600 hover:bg-indigo-500 text-white group-hover:shadow-lg group-hover:shadow-indigo-500/20"
          )}
        >
          {isCompleted ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Review Course
            </>
          ) : progress > 0 ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Continue Learning
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Learning
            </>
          )}
        </div>
      </div>
    </Link>
  );
}