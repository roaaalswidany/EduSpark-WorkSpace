/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
"use client";

import {
  useState,
  useCallback,
  useTransition,
  useEffect,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  SkipForward,
  SkipBack,
  BookOpen,
  Clock,
  Award,
  Menu,
  X,
  Loader2,
  AlertCircle,
  GraduationCap,
  Video,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { trackProgressAction } from "@/actions/lms/track-progress";
import type { CourseData, SectionData, LessonData } from "@/actions/lms/get-course";
import { cn, formatDuration } from "@/lib/utils";
import { LessonAttachmentsViewer } from "./lesson-attachments-viewer";

// ─── Video Player ─────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&#/]+)/,
    /[?&]v=([^?&#/]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

interface VideoPlayerProps {
  url: string | null;
  lessonId: string;
  onEnded: () => void;
}

function VideoPlayer({ url, lessonId, onEnded }: VideoPlayerProps) {
  const t = useTranslations("learning.video");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.load();
  }, [lessonId]);

  if (!url) {
    return (
      <div className="w-full aspect-video bg-background flex flex-col items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">{t("noVideo")}</p>
      </div>
    );
  }

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const vid = extractYouTubeId(url);
    if (!vid) return null;
    return (
      <div className="w-full aspect-video bg-black">
        <iframe
          key={lessonId}
          src={`https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (url.includes("vimeo.com")) {
    const vid = extractVimeoId(url);
    if (!vid) return null;
    return (
      <div className="w-full aspect-video bg-black">
        <iframe
          key={lessonId}
          src={`https://player.vimeo.com/video/${vid}?title=0&byline=0&portrait=0&dnt=1`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={lessonId}
      src={url}
      controls
      onEnded={onEnded}
      className="w-full aspect-video bg-black"
      controlsList="nodownload noremoteplayback"
    />
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({
  progress,
  size = 48,
}: {
  progress: number;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  const isPassed = progress >= 100;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={isPassed ? "var(--success)" : "var(--primary)"}
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

// ─── Completion Banner ────────────────────────────────────────────────────────

function CompletionBanner({
  title,
  courseId,
  hasQuiz,
}: {
  title: string;
  courseId: string;
  hasQuiz: boolean;
}) {
  const t = useTranslations("learning.completion");

  return (
    <div className="mx-4 sm:mx-6 mb-8 rounded-2xl bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
        <Award className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-1.5">
        {t("title")}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
        {hasQuiz
          ? t("descWithQuiz", { title })
          : t("descNoQuiz", { title })}
      </p>
      {hasQuiz && (
        <Link
          href={`/dashboard/student/courses/${courseId}/quiz`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          {t("takeQuiz")}
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

// ─── Lesson Row ───────────────────────────────────────────────────────────────

interface LessonRowProps {
  lesson: LessonData;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function LessonRow({ lesson, isActive, onSelect }: LessonRowProps) {
  const t = useTranslations("learning.lesson");

  return (
    <button
      onClick={() => onSelect(lesson.id)}
      className={cn(
        "w-full flex items-start gap-3 py-3 pl-5 pr-4 text-left",
        "border-r-[3px] rtl:border-r-0 rtl:border-l-[3px] transition-all duration-150",
        isActive
          ? "bg-primary/10 border-primary"
          : "border-transparent hover:bg-accent/50"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {lesson.isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : isActive ? (
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          </div>
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-medium leading-snug line-clamp-2 transition-colors",
            isActive
              ? "text-primary"
              : lesson.isCompleted
              ? "text-muted-foreground"
              : "text-foreground"
          )}
        >
          {lesson.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {lesson.isFree && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {t("free")}
            </span>
          )}
          {lesson.duration != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(lesson.duration)}
            </span>
          )}
        </div>
      </div>

      {isActive && (
        <Play className="w-3 h-3 text-primary shrink-0 mt-0.5 fill-current" />
      )}
    </button>
  );
}

// ─── Section Accordion ────────────────────────────────────────────────────────

interface SectionAccordionProps {
  section: SectionData;
  index: number;
  isExpanded: boolean;
  activeLessonId: string;
  onToggle: (id: string) => void;
  onLessonSelect: (id: string) => void;
}

function SectionAccordion({
  section,
  index,
  isExpanded,
  activeLessonId,
  onToggle,
  onLessonSelect,
}: SectionAccordionProps) {
  const isComplete =
    section.totalCount > 0 && section.completedCount === section.totalCount;
  const sectionProgress =
    section.totalCount > 0
      ? (section.completedCount / section.totalCount) * 100
      : 0;

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => onToggle(section.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/30 transition-colors text-left group"
      >
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
            isComplete
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-accent text-muted-foreground group-hover:bg-accent/80"
          )}
        >
          {isComplete ? "✓" : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
            {section.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-accent rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isComplete ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${sectionProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {section.completedCount}/{section.totalCount}
            </span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="pb-1">
          {section.lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              isActive={lesson.id === activeLessonId}
              onSelect={onLessonSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CourseLearningViewProps {
  course: CourseData;
  initialLessonId: string;
  hasQuiz: boolean;
}

export function CourseLearningView({
  course,
  initialLessonId,
  hasQuiz,
}: CourseLearningViewProps) {
  const tHeader = useTranslations("learning.header");
  const tLesson = useTranslations("learning.lesson");
  const tSidebar = useTranslations("learning.sidebar");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeLessonId, setActiveLessonId] = useState(initialLessonId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const [sections, setSections] = useState<SectionData[]>(course.sections);
  const [progress, setProgress] = useState(course.enrollment?.progress ?? 0);
  const [completedLessons, setCompletedLessons] = useState(
    course.completedLessons
  );
  const [isPassed, setIsPassed] = useState(
    course.enrollment?.isPassed ?? false
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => {
      const initial = new Set<string>();
      for (const section of course.sections) {
        if (section.lessons.some((l) => l.id === initialLessonId)) {
          initial.add(section.id);
          break;
        }
      }
      return initial;
    }
  );

  const allLessons = sections.flatMap((s) => s.lessons);
  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson: LessonData | undefined = allLessons[activeIndex];
  const prevLesson: LessonData | undefined = allLessons[activeIndex - 1];
  const nextLesson: LessonData | undefined = allLessons[activeIndex + 1];

  useEffect(() => {
    for (const section of sections) {
      if (section.lessons.some((l) => l.id === activeLessonId)) {
        setExpandedSections((prev) => new Set([...prev, section.id]));
        break;
      }
    }
    setSidebarOpen(false);
  }, [activeLessonId]);

  const selectLesson = useCallback(
    (lessonId: string) => {
      setActiveLessonId(lessonId);
      setTrackError(null);
      router.replace(`?lessonId=${lessonId}`, { scroll: false });
    },
    [router]
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleMarkComplete = useCallback(() => {
    if (!activeLesson || activeLesson.isCompleted || isPending) return;

    setTrackError(null);

    const snapshot = {
      sections,
      progress,
      completedLessons,
    };

    const newCompletedCount = completedLessons + 1;
    const newProgress = Math.min(
      100,
      Math.round((newCompletedCount / course.totalLessons) * 100)
    );

    setSections((prev) =>
      prev.map((section) => {
        const contains = section.lessons.some((l) => l.id === activeLessonId);
        if (!contains) return section;
        const wasCompleted = section.lessons.find(
          (l) => l.id === activeLessonId
        )?.isCompleted;
        return {
          ...section,
          completedCount: wasCompleted
            ? section.completedCount
            : section.completedCount + 1,
          lessons: section.lessons.map((l) =>
            l.id === activeLessonId
              ? { ...l, isCompleted: true, watchedAt: new Date() }
              : l
          ),
        };
      })
    );
    setProgress(newProgress);
    setCompletedLessons(newCompletedCount);

    startTransition(async () => {
      const result = await trackProgressAction({
        courseId: course.id,
        lessonId: activeLessonId,
      });

      if (result.success) {
        setProgress(result.progress);
        setCompletedLessons(result.completedLessons);
        setIsPassed(result.isPassed);

        if (nextLesson && !result.isPassed) {
          setTimeout(() => selectLesson(nextLesson.id), 700);
        }
      } else {
        setSections(snapshot.sections);
        setProgress(snapshot.progress);
        setCompletedLessons(snapshot.completedLessons);
        setTrackError("Progress not saved — please try again.");
      }
    });
  }, [
    activeLesson,
    activeLessonId,
    completedLessons,
    course.id,
    course.totalLessons,
    isPending,
    nextLesson,
    progress,
    sections,
    selectLesson,
  ]);

  const handleVideoEnded = useCallback(() => {
    if (activeLesson && !activeLesson.isCompleted) {
      handleMarkComplete();
    } else if (nextLesson) {
      selectLesson(nextLesson.id);
    }
  }, [activeLesson, handleMarkComplete, nextLesson, selectLesson]);

  if (!activeLesson) return null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Top header */}
      <header className="h-14 shrink-0 bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center px-4 gap-2 z-50">
        <Link
          href="/dashboard/student/courses"
          title={tHeader("backToCourses")}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>

        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={tHeader("toggleMenu")}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GraduationCap className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-bold text-primary hidden sm:block shrink-0">
            EduSpark
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground hidden sm:block shrink-0 rtl:rotate-180" />
          <h1 className="text-sm font-medium text-muted-foreground truncate hidden sm:block">
            {course.title}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isPassed && (
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              <Award className="w-3.5 h-3.5" />
              {tHeader("completed")}
            </span>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground hidden sm:block">
              <span className="text-foreground font-semibold">
                {completedLessons}
              </span>
              /{course.totalLessons}
            </span>
            <div className="w-24 h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-emerald-500 to-emerald-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              className={cn(
                "text-xs font-bold w-8 tabular-nums",
                progress >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-primary"
              )}
            >
              {progress}%
            </span>
          </div>
          <Link
            href={`/courses/${course.slug}`}
            target="_blank"
            title={tHeader("viewPublicPage")}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-accent/60 hover:bg-accent text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="w-full bg-black">
            <div className="max-w-5xl mx-auto">
              <VideoPlayer
                url={activeLesson.videoUrl}
                lessonId={activeLesson.id}
                onEnded={handleVideoEnded}
              />
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  {tLesson("label", {
                    current: activeIndex + 1,
                    total: allLessons.length,
                  })}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  {activeLesson.title}
                </h2>
                {activeLesson.duration != null && (
                  <div className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDuration(activeLesson.duration)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {activeLesson.isCompleted ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold select-none">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{tLesson("completed")}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleMarkComplete}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl",
                      "text-sm font-semibold text-primary-foreground",
                      "bg-primary hover:bg-primary/90 active:scale-95",
                      "shadow-lg shadow-primary/25",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                      "transition-all duration-150"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {isPending ? tLesson("saving") : tLesson("markComplete")}
                    </span>
                  </button>
                )}

                {trackError && (
                  <div className="flex items-center gap-1.5 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{trackError}</span>
                  </div>
                )}
              </div>
            </div>

            {activeLesson.description && (
              <div className="rounded-xl bg-card/60 border border-border p-5">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {activeLesson.description}
                </p>
              </div>
            )}

            {activeLesson.attachments && activeLesson.attachments.length > 0 && (
              <LessonAttachmentsViewer attachments={activeLesson.attachments} />
            )}

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/70">
              <button
                onClick={() => prevLesson && selectLesson(prevLesson.id)}
                disabled={!prevLesson}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
                  "border border-border text-muted-foreground",
                  "hover:border-primary/40 hover:bg-card hover:text-foreground",
                  "disabled:opacity-20 disabled:cursor-not-allowed",
                  "transition-all duration-150"
                )}
              >
                <SkipBack className="w-4 h-4 rtl:rotate-180" />
                <span className="hidden sm:block max-w-30 truncate">
                  {prevLesson?.title ?? tLesson("previous")}
                </span>
              </button>

              <div
                className="flex items-center gap-1.5 overflow-hidden"
                aria-label={tLesson("progressTrack")}
              >
                {allLessons
                  .slice(
                    Math.max(0, activeIndex - 3),
                    Math.min(allLessons.length, activeIndex + 4)
                  )
                  .map((lesson) => (
                    <button
                      key={lesson.id}
                      title={lesson.title}
                      onClick={() => selectLesson(lesson.id)}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        lesson.id === activeLessonId
                          ? "w-5 h-2 bg-primary"
                          : lesson.isCompleted
                          ? "w-2 h-2 bg-emerald-500 hover:bg-emerald-400"
                          : "w-2 h-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                      )}
                    />
                  ))}
              </div>

              <button
                onClick={() => nextLesson && selectLesson(nextLesson.id)}
                disabled={!nextLesson}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
                  "border border-border text-muted-foreground",
                  "hover:border-primary/40 hover:bg-card hover:text-foreground",
                  "disabled:opacity-20 disabled:cursor-not-allowed",
                  "transition-all duration-150"
                )}
              >
                <span className="hidden sm:block max-w-30 truncate">
                  {nextLesson?.title ?? tLesson("next")}
                </span>
                <SkipForward className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>

            {isPassed && (
              <CompletionBanner
                title={course.title}
                courseId={course.id}
                hasQuiz={hasQuiz}
              />
            )}
          </div>
        </main>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "w-80 xl:w-96 bg-card border-l rtl:border-l-0 rtl:border-r border-border/80 flex flex-col shrink-0 overflow-hidden",
            "fixed right-0 rtl:right-auto rtl:left-0 top-14 bottom-0 z-40",
            "lg:relative lg:top-auto lg:bottom-auto lg:z-auto rtl:lg:left-auto rtl:lg:right-auto",
            "transition-transform duration-300 ease-in-out",
            sidebarOpen
              ? "translate-x-0"
              : "translate-x-full rtl:-translate-x-full lg:translate-x-0 rtl:lg:translate-x-0"
          )}
        >
          <div className="px-4 py-4 border-b border-border/80 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative shrink-0">
                <ProgressRing progress={progress} size={48} />
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
                    progress >= 100
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-primary"
                  )}
                >
                  {progress}%
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">
                  {course.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tSidebar("lessonsDone", {
                    completed: completedLessons,
                    total: course.totalLessons,
                  })}
                </p>
              </div>
            </div>

            <div className="h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-emerald-600 to-emerald-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {sections.map((section, idx) => (
              <SectionAccordion
                key={section.id}
                section={section}
                index={idx}
                isExpanded={expandedSections.has(section.id)}
                activeLessonId={activeLessonId}
                onToggle={toggleSection}
                onLessonSelect={selectLesson}
              />
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border/80 shrink-0 flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {tSidebar("instructor")}{" "}
              <span className="text-foreground">{course.creator.name}</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}