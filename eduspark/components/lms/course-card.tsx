/* eslint-disable @typescript-eslint/no-unused-vars */
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Star, Users, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseLevel } from "@prisma/client";

export interface CourseCardData {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  price: number;
  level: CourseLevel;
  language: string;
  tags: string[];
  totalRating: number;
  ratingCount: number;
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
  };
  category: { id: string; name: string; slug: string } | null;
  totalLessons: number;
  totalDuration: number;
  isEnrolled: boolean;
  enrollmentProgress: number | null;
  isPassed: boolean;
}

const LEVEL_STYLES: Record<CourseLevel, string> = {
  BEGINNER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  INTERMEDIATE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ADVANCED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const showEnrolled = course.isEnrolled;
  const progress = course.enrollmentProgress ?? 0;

  return (
    <Link
      href={showEnrolled ? `/dashboard/student/courses/${course.id}` : `/courses/${course.slug}`}
      className={cn(
        "group flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden",
        "hover:border-indigo-500/40 hover:bg-slate-900/80",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5"
      )}
    >
      {/* ── Thumbnail ─────────────────────────────────────────── */}
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

        {/* Dark gradient overlay for text visibility */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

        {/* Level badge top-left */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
              LEVEL_STYLES[course.level]
            )}
          >
            {LEVEL_LABELS[course.level]}
          </span>
        </div>

        {/* Enrolled badge top-right */}
        {showEnrolled && (
          <div className="absolute top-3 right-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
                course.isPassed
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
              )}
            >
              {course.isPassed ? (
                <>
                  <Award className="w-3 h-3" />
                  Completed
                </>
              ) : (
                <>Enrolled</>
              )}
            </span>
          </div>
        )}

        {/* Progress bar bottom (if enrolled) */}
        {showEnrolled && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/60">
            <div
              className={cn(
                "h-full transition-all duration-500",
                course.isPassed
                  ? "bg-linear-to-r from-emerald-500 to-teal-400"
                  : "bg-linear-to-r from-indigo-500 to-violet-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
        {/* Category */}
        {course.category && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            {course.category.name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {course.title}
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        {/* Creator */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {course.creator.image ? (
            <Image
              src={course.creator.image}
              alt={course.creator.name}
              width={24}
              height={24}
              className="rounded-full object-cover ring-1 ring-slate-700"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-1 ring-slate-700">
              {course.creator.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <span className="text-xs text-slate-400 truncate">
            {course.creator.name}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
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
          {course.ratingCount > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-amber-300 font-semibold">
                {course.totalRating.toFixed(1)}
              </span>
              <span className="text-slate-600">({course.ratingCount})</span>
            </span>
          )}
        </div>

        {/* Price / Progress footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          {showEnrolled ? (
            <>
              <span className="text-xs text-slate-500">Progress</span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  course.isPassed ? "text-emerald-400" : "text-indigo-400"
                )}
              >
                {progress}%
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-500">Price</span>
              {course.price === 0 ? (
                <span className="text-sm font-bold text-emerald-400">Free</span>
              ) : (
                <span className="text-base font-black text-white tabular-nums">
                  ${course.price.toFixed(2)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}