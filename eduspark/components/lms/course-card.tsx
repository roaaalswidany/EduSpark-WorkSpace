import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BookOpen, Clock, Star, Award } from "lucide-react";
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
  BEGINNER:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  INTERMEDIATE:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ADVANCED:
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function CourseCard({ course }: { course: CourseCardData }) {
  const t = await getTranslations("courses.card");
  const showEnrolled = course.isEnrolled;
  const progress = course.enrollmentProgress ?? 0;

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

  const levelKey = course.level.toLowerCase() as
    | "beginner"
    | "intermediate"
    | "advanced";
  const levelLabel = t(`levels.${levelKey}`);

  return (
    <Link
      href={
        showEnrolled
          ? `/dashboard/student/courses/${course.id}`
          : `/courses/${course.slug}`
      }
      className={cn(
        "group flex flex-col rounded-2xl bg-card border border-border overflow-hidden",
        "hover:border-primary/40 hover:bg-card/80",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      {/* ── Thumbnail ─────────────────────────────────────── */}
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

        <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-zinc-950/20 to-transparent" />

        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
              LEVEL_STYLES[course.level]
            )}
          >
            {levelLabel}
          </span>
        </div>

        {showEnrolled && (
          <div className="absolute top-3 right-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm",
                course.isPassed
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-primary/15 text-primary border-primary/30"
              )}
            >
              {course.isPassed ? (
                <>
                  <Award className="w-3 h-3" />
                  {t("completed")}
                </>
              ) : (
                <>{t("enrolled")}</>
              )}
            </span>
          </div>
        )}

        {showEnrolled && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/60">
            <div
              className={cn(
                "h-full transition-all duration-500",
                course.isPassed
                  ? "bg-linear-to-r from-emerald-500 to-teal-400"
                  : "bg-linear-to-r from-emerald-500 to-emerald-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
        {course.category && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {course.category.name}
          </span>
        )}

        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>

        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        <div className="flex items-center gap-2 mt-auto pt-2">
          <div
            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ring-1 ring-border shrink-0"
            style={{ background: `hsl(${creatorHue}, 55%, 42%)` }}
          >
            {creatorInitials}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {course.creator.name}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {t("lessons", { count: course.totalLessons })}
          </span>
          {course.totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(course.totalDuration)}
            </span>
          )}
          {course.ratingCount > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {course.totalRating.toFixed(1)}
              </span>
              <span className="text-muted-foreground/70">
                ({course.ratingCount})
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          {showEnrolled ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t("progress")}
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  course.isPassed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-primary"
                )}
              >
                {progress}%
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {t("price")}
              </span>
              {course.price === 0 ? (
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {t("free")}
                </span>
              ) : (
                <span className="text-base font-black text-foreground tabular-nums">
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