/* eslint-disable react-hooks/preserve-manual-memoization */
"use client";

import {
  useState,
  useCallback,
  useTransition,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
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
} from "lucide-react";

import { trackProgressAction } from "@/app/actions/lms/track-progress";
import type { CourseData, SectionData, LessonData } from "@/app/actions/lms/get-course";
import { cn, formatDuration } from "@/app/lib/utils";

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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset native video to start when lesson changes
  useEffect(() => {
    videoRef.current?.load();
  }, [lessonId]);

  if (!url) {
    return (
      <div className="w-full aspect-video bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-slate-600" />
        </div>
        <p className="text-slate-600 text-sm">No video for this lesson</p>
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

// ─── Progress Ring (sidebar header) ──────────────────────────────────────────

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
        stroke="rgb(30 41 59)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={isPassed ? "rgb(52 211 153)" : "rgb(99 102 241)"}
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

function CompletionBanner({ title }: { title: string }) {
  return (
    <div className="mx-4 sm:mx-6 mb-8 rounded-2xl bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/10 border border-emerald-500/20 p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
        <Award className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-1.5">
        Course Complete! 🎉
      </h3>
      <p className="text-slate-400 text-sm max-w-sm mx-auto">
        You finished{" "}
        <span className="text-white font-medium">{title}</span>. Certificate
        is now available in your dashboard.
      </p>
    </div>
  );
}

// ─── Lesson Row (sidebar) ─────────────────────────────────────────────────────

interface LessonRowProps {
  lesson: LessonData;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function LessonRow({ lesson, isActive, onSelect }: LessonRowProps) {
  return (
    <button
      onClick={() => onSelect(lesson.id)}
      className={cn(
        "w-full flex items-start gap-3 py-3 pl-5 pr-4 text-left",
        "border-r-[3px] transition-all duration-150",
        isActive
          ? "bg-indigo-500/10 border-indigo-500"
          : "border-transparent hover:bg-slate-800/50"
      )}
    >
      {/* Completion indicator */}
      <div className="mt-0.5 shrink-0">
        {lesson.isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : isActive ? (
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
          </div>
        ) : (
          <Circle className="w-4 h-4 text-slate-700" />
        )}
      </div>

      {/* Lesson info */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-medium leading-snug line-clamp-2 transition-colors",
            isActive
              ? "text-indigo-300"
              : lesson.isCompleted
              ? "text-slate-500"
              : "text-slate-300"
          )}
        >
          {lesson.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {lesson.isFree && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Free
            </span>
          )}
          {lesson.duration != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(lesson.duration)}
            </span>
          )}
        </div>
      </div>

      {isActive && (
        <Play className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5 fill-current" />
      )}
    </button>
  );
}

// ─── Section Accordion (sidebar) ─────────────────────────────────────────────

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
    <div className="border-b border-slate-800/60 last:border-0">
      {/* Section header button */}
      <button
        onClick={() => onToggle(section.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors text-left group"
      >
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
            isComplete
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
          )}
        >
          {isComplete ? "✓" : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-white transition-colors">
            {section.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isComplete ? "bg-emerald-500" : "bg-indigo-600"
                )}
                style={{ width: `${sectionProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-600 shrink-0">
              {section.completedCount}/{section.totalCount}
            </span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-slate-600 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Lessons */}
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
}

export function CourseLearningView({
  course,
  initialLessonId,
}: CourseLearningViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Core UI state
  const [activeLessonId, setActiveLessonId] = useState(initialLessonId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // ── Data state (client-owned copy — optimistic updates applied here)
  const [sections, setSections] = useState<SectionData[]>(course.sections);
  const [progress, setProgress] = useState(course.enrollment?.progress ?? 0);
  const [completedLessons, setCompletedLessons] = useState(
    course.completedLessons
  );
  const [isPassed, setIsPassed] = useState(
    course.enrollment?.isPassed ?? false
  );

  // ── Expanded sections — auto-open section containing initial lesson
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

  // ── Derived flat lesson list & navigation
  const allLessons = sections.flatMap((s) => s.lessons);
  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson: LessonData | undefined = allLessons[activeIndex];
  const prevLesson: LessonData | undefined = allLessons[activeIndex - 1];
  const nextLesson: LessonData | undefined = allLessons[activeIndex + 1];

  // Auto-expand the section of the newly activated lesson
  useEffect(() => {
    for (const section of sections) {
      if (section.lessons.some((l) => l.id === activeLessonId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpandedSections((prev) => new Set([...prev, section.id]));
        break;
      }
    }
    // Close mobile sidebar whenever lesson changes
    setSidebarOpen(false);
  }, [activeLessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation
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

  // ── Progress tracking
  const handleMarkComplete = useCallback(() => {
    if (!activeLesson || activeLesson.isCompleted || isPending) return;

    setTrackError(null);

    // ── Snapshot for rollback
    const snapshot = {
      sections,
      progress,
      completedLessons,
    };

    // ── Optimistic update: mark lesson + recalc progress immediately
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

    // ── Commit to server
    startTransition(async () => {
      const result = await trackProgressAction({
        courseId: course.id,
        lessonId: activeLessonId,
      });

      if (result.success) {
        // Reconcile with server's authoritative values
        setProgress(result.progress);
        setCompletedLessons(result.completedLessons);
        setIsPassed(result.isPassed);

        if (nextLesson && !result.isPassed) {
          setTimeout(() => selectLesson(nextLesson.id), 700);
        }
      } else {
        // Rollback optimistic update on failure
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

  // Auto-complete + advance when native video ends
  const handleVideoEnded = useCallback(() => {
    if (activeLesson && !activeLesson.isCompleted) {
      handleMarkComplete();
    } else if (nextLesson) {
      selectLesson(nextLesson.id);
    }
  }, [activeLesson, handleMarkComplete, nextLesson, selectLesson]);

  if (!activeLesson) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* ──────────────────────────────────────── Top header */}
      <header className="h-14 shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 flex items-center px-4 gap-3 z-50">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle course menu"
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {sidebarOpen ? (
            <X className="w-4.5 h-4.5 text-slate-400" />
          ) : (
            <Menu className="w-4.5 h-4.5 text-slate-400" />
          )}
        </button>

        {/* Brand + breadcrumb */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GraduationCap className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-sm font-bold text-indigo-400 hidden sm:block shrink-0">
            EduSpark
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700 hidden sm:block shrink-0" />
          <h1 className="text-sm font-medium text-slate-400 truncate hidden sm:block">
            {course.title}
          </h1>
        </div>

        {/* Completion badge + progress */}
        <div className="flex items-center gap-3 shrink-0">
          {isPassed && (
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              <Award className="w-3.5 h-3.5" />
              Completed
            </span>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 hidden sm:block">
              <span className="text-slate-300 font-semibold">
                {completedLessons}
              </span>
              /{course.totalLessons}
            </span>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-indigo-500 to-violet-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              className={cn(
                "text-xs font-bold w-8 tabular-nums",
                progress >= 100 ? "text-emerald-400" : "text-indigo-400"
              )}
            >
              {progress}%
            </span>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────── Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main content area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          {/* Video */}
          <div className="w-full bg-black">
            <div className="max-w-5xl mx-auto">
              <VideoPlayer
                url={activeLesson.videoUrl}
                lessonId={activeLesson.id}
                onEnded={handleVideoEnded}
              />
            </div>
          </div>

          {/* Lesson info */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-widest">
                  Lesson {activeIndex + 1} of {allLessons.length}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                  {activeLesson.title}
                </h2>
                {activeLesson.duration != null && (
                  <div className="inline-flex items-center gap-1.5 text-slate-500 text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDuration(activeLesson.duration)}</span>
                  </div>
                )}
              </div>

              {/* Mark complete CTA */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {activeLesson.isCompleted ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold select-none">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleMarkComplete}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl",
                      "text-sm font-semibold text-white",
                      "bg-indigo-600 hover:bg-indigo-500 active:scale-95",
                      "shadow-lg shadow-indigo-500/25",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                      "transition-all duration-150"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{isPending ? "Saving…" : "Mark Complete"}</span>
                  </button>
                )}

                {trackError && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{trackError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {activeLesson.description && (
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
                <p className="text-slate-400 text-sm leading-relaxed">
                  {activeLesson.description}
                </p>
              </div>
            )}

            {/* Prev / dot tracker / Next */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/70">
              <button
                onClick={() => prevLesson && selectLesson(prevLesson.id)}
                disabled={!prevLesson}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
                  "border border-slate-800 text-slate-500",
                  "hover:border-slate-700 hover:bg-slate-900 hover:text-slate-300",
                  "disabled:opacity-20 disabled:cursor-not-allowed",
                  "transition-all duration-150"
                )}
              >
                <SkipBack className="w-4 h-4" />
                <span className="hidden sm:block max-w-30 truncate">
                  {prevLesson?.title ?? "Previous"}
                </span>
              </button>

              {/* Mini dot progress track */}
              <div
                className="flex items-center gap-1.5 overflow-hidden"
                aria-label="Lesson progress track"
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
                          ? "w-5 h-2 bg-indigo-500"
                          : lesson.isCompleted
                          ? "w-2 h-2 bg-emerald-600 hover:bg-emerald-500"
                          : "w-2 h-2 bg-slate-700 hover:bg-slate-600"
                      )}
                    />
                  ))}
              </div>

              <button
                onClick={() => nextLesson && selectLesson(nextLesson.id)}
                disabled={!nextLesson}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
                  "border border-slate-800 text-slate-500",
                  "hover:border-slate-700 hover:bg-slate-900 hover:text-slate-300",
                  "disabled:opacity-20 disabled:cursor-not-allowed",
                  "transition-all duration-150"
                )}
              >
                <span className="hidden sm:block max-w-30 truncate">
                  {nextLesson?.title ?? "Next"}
                </span>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Course complete banner */}
            {isPassed && <CompletionBanner title={course.title} />}
          </div>
        </main>

        {/* ── Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar */}
        <aside
          className={cn(
            "w-80 xl:w-96 bg-slate-900 border-l border-slate-800/80 flex flex-col shrink-0 overflow-hidden",
            // Mobile: fixed overlay
            "fixed right-0 top-14 bottom-0 z-40",
            // Desktop: inline
            "lg:relative lg:top-auto lg:bottom-auto lg:z-auto",
            // Slide transition
            "transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          )}
        >
          {/* Sidebar header: ring + stats */}
          <div className="px-4 py-4 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              {/* Progress ring */}
              <div className="relative shrink-0">
                <ProgressRing progress={progress} size={48} />
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
                    progress >= 100 ? "text-emerald-400" : "text-indigo-400"
                  )}
                >
                  {progress}%
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-200 truncate">
                  {course.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {completedLessons} of {course.totalLessons} lessons done
                </p>
              </div>
            </div>

            {/* Thin progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  progress >= 100
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-indigo-600 to-violet-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Scrollable section list */}
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

          {/* Sidebar footer */}
          <div className="px-4 py-3 border-t border-slate-800/80 shrink-0 flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <p className="text-xs text-slate-600 truncate">
              Instructor:{" "}
              <span className="text-slate-500">{course.creator.name}</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}