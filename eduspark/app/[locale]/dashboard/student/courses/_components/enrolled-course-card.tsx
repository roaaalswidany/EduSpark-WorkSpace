/* eslint-disable react-hooks/purity */
"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  Clock,
  Play,
  Award,
  TrendingUp,
  RotateCcw,
  ExternalLink,
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

const LEVEL_KEYS: Record<CourseLevel, "beginner" | "intermediate" | "advanced"> = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
};

export function EnrolledCourseCard({ course }: { course: EnrolledCourse }) {
  const t = useTranslations("studentCourses.card");
  const locale = useLocale();

  function formatDuration(seconds: number): string {
    if (seconds < 60) return t("durationSeconds", { count: seconds });
    const min = Math.floor(seconds / 60);
    if (min < 60) return t("durationMinutes", { count: min });
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0
      ? t("durationHoursMinutes", { hours: h, minutes: m })
      : t("durationHours", { hours: h });
  }

  function formatRelative(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return t("time.justNow");
    if (min < 60) return t("time.minutesAgo", { count: min });
    const hours = Math.floor(min / 60);
    if (hours < 24) return t("time.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t("time.yesterday");
    if (days < 7) return t("time.daysAgo", { count: days });
    return new Date(date).toLocaleDateString(
      locale === "ar" ? "ar" : "en-US",
      { month: "short", day: "numeric" }
    );
  }

  const isCompleted = course.isPassed;
  const progress = Math.min(100, Math.round(course.progress));
  const levelLabel = t(`levels.${LEVEL_KEYS[course.level]}`);

  const creatorInitials = course.creator.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const creatorHue =
    course.creator.name
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <Link
      href={`/dashboard/student/courses/${course.courseId}`}
      className={cn(
        "group flex flex-col rounded-2xl bg-card border overflow-hidden",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        isCompleted
          ? "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/5"
          : "border-border hover:border-primary/40 hover:shadow-primary/5"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-background overflow-hidden">
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-500/10 via-muted to-emerald-500/10">
            <BookOpen className="w-12 h-12 text-muted-foreground/70" />
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-zinc-950/95 via-zinc-950/30 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
              <Award className="w-3 h-3" />
              {t("statusCompleted")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm bg-primary/15 text-primary border-primary/30">
              <TrendingUp className="w-3 h-3" />
              {t("statusInProgress")}
            </span>
          )}
        </div>

        {/* Level + Progress */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary backdrop-blur-sm bg-background/60 px-2 py-1 rounded">
            {course.category?.name ?? levelLabel}
          </span>
          <span className="text-[10px] font-semibold text-foreground backdrop-blur-sm bg-background/60 px-2 py-1 rounded tabular-nums">
            {progress}%
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>

        {/* Instructor */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-border shrink-0"
            style={{ background: `hsl(${creatorHue}, 55%, 42%)` }}
          >
            {creatorInitials}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {course.creator.name}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 mt-auto">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="text-muted-foreground">
              {isCompleted ? t("allCompleted") : t("yourProgress")}
            </span>
            <span
              className={cn(
                "tabular-nums",
                isCompleted
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-primary"
              )}
            >
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-accent rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCompleted
                  ? "bg-linear-to-r from-emerald-500 to-teal-400"
                  : "bg-linear-to-r from-emerald-500 to-emerald-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {t("lessonsCount", { count: course.totalLessons })}
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

        {/* CTA row */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
              isCompleted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/15"
                : "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:shadow-lg group-hover:shadow-emerald-500/20"
            )}
          >
            {isCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                {t("reviewCourse")}
              </>
            ) : progress > 0 ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                {t("continueLearning")}
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                {t("startLearning")}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`/${locale}/courses/${course.courseSlug}`, "_blank");
            }}
            title={t("viewPublicPage")}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-accent hover:bg-accent/80 text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Link>
  );
}