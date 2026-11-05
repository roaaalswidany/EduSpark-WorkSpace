/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LessonAttachments, type AttachmentInfo } from "./lesson-attachments";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Video,
  Clock,
  Eye,
  EyeOff,
  Send,
  Loader2,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Users,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import {
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
} from "@/actions/creator/manage-curriculum";
import { updateCourseStatusAction } from "@/actions/creator/publish-course";

// ─── Types ──────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number | null;
  isFree: boolean;
  order: number;
  attachments: AttachmentInfo[];
}

interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
  reviewNote?: string | null;
  enrollmentCount: number;
}

interface Props {
  course: Course;
  sections: Section[];
}

// ─── Main Component ─────────────────────────────────────────────

export function CurriculumEditor({ course, sections }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddSection, setShowAddSection] = useState(false);

  const totalLessons = sections.reduce((s, sec) => s + sec.lessons.length, 0);

  // Creators cannot publish: DRAFT → PENDING_REVIEW (admin decides) · PENDING_REVIEW/PUBLISHED → DRAFT.
  const handleStatusAction = () => {
    const newStatus =
      course.status === "DRAFT" ? "PENDING_REVIEW" : "DRAFT";

    startTransition(async () => {
      const result = await updateCourseStatusAction({
        courseId: course.id,
        status: newStatus,
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          CANNOT_PUBLISH_EMPTY_COURSE:
            "Add at least one lesson before submitting for review.",
          QUIZ_TOO_SHORT:
            "The course quiz needs at least 4 published questions before submitting.",
          REVIEW_REQUIRED: "Only an administrator can publish a course.",
          INVALID_STATE: "The course status changed. Refresh the page.",
          FORBIDDEN: "You don't have permission.",
          UNAUTHORIZED: "Please sign in again.",
          NOT_FOUND: "Course not found.",
          SERVER_ERROR: "Something went wrong. Try again.",
        };
        toast.error("Could not update status", {
          description: messages[result.error ?? ""] ?? "Unknown error",
        });
        return;
      }

      if (newStatus === "PENDING_REVIEW") {
        toast.success("Submitted for review 📬", {
          description:
            "An administrator will review your course. Editing is locked meanwhile.",
        });
      } else {
        toast.success("Course moved to draft 📝", {
          description:
            course.status === "PENDING_REVIEW"
              ? "Submission withdrawn. You can edit again."
              : "Hidden from students. Resubmit it for review after your changes.",
        });
      }
      router.refresh();
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link
          href="/dashboard/creator/courses"
          className="hover:text-slate-300 transition-colors"
        >
          My Courses
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-400 truncate">{course.title}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-300">Edit Curriculum</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                course.status === "PUBLISHED"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : course.status === "DRAFT"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : course.status === "PENDING_REVIEW"
                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                  : "bg-slate-700/50 text-slate-400 border-slate-700"
              )}
            >
              {course.status.replace("_", " ")}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> {course.enrollmentCount} enrolled
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{course.title}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage sections, lessons, and course content.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/courses/${course.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview
          </Link>
          {course.status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={handleStatusAction}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                course.status === "DRAFT"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300",
                isPending && "opacity-60"
              )}
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : course.status === "DRAFT" ? (
                <Send className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {course.status === "DRAFT"
                ? "Submit for review"
                : course.status === "PENDING_REVIEW"
                ? "Withdraw"
                : "Unpublish"}
            </button>
          )}
        </div>
      </div>

      {course.status === "PENDING_REVIEW" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
          <Clock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-sm text-sky-200">
            <strong>Under review.</strong> Editing is locked until an administrator decides.
            You can withdraw the submission to keep editing.
          </p>
        </div>
      )}
      {course.status === "DRAFT" && course.reviewNote && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            <strong>Changes requested:</strong> {course.reviewNote}
          </p>
        </div>
      )}
      {course.status === "PUBLISHED" && (
        <p className="text-xs text-slate-500">
          This course was approved. To change its quiz, unpublish it first — it will need a new review.
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <BookOpen className="w-3.5 h-3.5" /> Sections
          </div>
          <p className="text-xl font-bold text-white tabular-nums">
            {sections.length}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Video className="w-3.5 h-3.5" /> Lessons
          </div>
          <p className="text-xl font-bold text-white tabular-nums">
            {totalLessons}
          </p>
        </div>
      </div>

      {/* Add Section */}
      {showAddSection ? (
        <AddSectionForm
          courseId={course.id}
          onClose={() => setShowAddSection(false)}
          onSuccess={() => {
            setShowAddSection(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddSection(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 text-slate-500 hover:text-indigo-400 text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      )}

      {/* Sections List */}
      {sections.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-7 h-7 text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1.5">
            No sections yet
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Start by adding your first section above, then add lessons inside it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              index={idx}
              courseId={course.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Section Form ───────────────────────────────────────────

function AddSectionForm({
  courseId,
  onClose,
  onSuccess,
}: {
  courseId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createSectionAction({ courseId, title: title.trim() });

      if (!result.success) {
        setError(result.error);
        return;
      }

      toast.success("Section created");
      onSuccess();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-slate-900 border border-indigo-500/30 p-4 space-y-3"
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section title (e.g., Introduction)"
        disabled={isPending}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
      />
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || title.trim().length < 2}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Section
        </button>
      </div>
    </form>
  );
}

// ─── Section Card ───────────────────────────────────────────────

function SectionCard({
  section,
  index,
  courseId,
}: {
  section: Section;
  index: number;
  courseId: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [isPending, startTransition] = useTransition();
  const [showAddLesson, setShowAddLesson] = useState(false);

  const handleRename = () => {
    if (editTitle.trim() === section.title) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateSectionAction({
        sectionId: section.id,
        title: editTitle.trim(),
      });
      if (result.success) {
        toast.success("Section renamed");
        setEditing(false);
        router.refresh();
      } else {
        toast.error("Could not rename");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete section "${section.title}" and all its lessons?`)) return;

    startTransition(async () => {
      const result = await deleteSectionAction(section.id);
      if (result.success) {
        toast.success("Section deleted");
        router.refresh();
      } else {
        toast.error("Could not delete");
      }
    });
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-500 transition-colors shrink-0"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              !expanded && "-rotate-90"
            )}
          />
        </button>

        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
          {index + 1}
        </div>

        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditTitle(section.title);
                }
              }}
              className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none"
            />
            <button
              onClick={handleRename}
              disabled={isPending}
              className="text-emerald-400 hover:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditTitle(section.title);
              }}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 text-sm font-bold text-white truncate">
              {section.title}
            </h3>
            <span className="text-[10px] text-slate-500 shrink-0">
              {section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Lessons */}
      {expanded && (
        <div className="p-3 space-y-2">
          {section.lessons.length === 0 && !showAddLesson && (
            <p className="text-xs text-slate-600 text-center py-3">
              No lessons yet.
            </p>
          )}

          {section.lessons.map((lesson, lidx) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              sectionId={section.id}
              index={lidx}
            />
          ))}

          {showAddLesson ? (
            <LessonForm
              sectionId={section.id}
              onClose={() => setShowAddLesson(false)}
              onSuccess={() => {
                setShowAddLesson(false);
                router.refresh();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddLesson(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-800 hover:border-indigo-500/40 text-slate-600 hover:text-indigo-400 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lesson
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lesson Row ─────────────────────────────────────────────────

function LessonRow({
  lesson,
  sectionId,
  index,
}: {
  lesson: Lesson;
  sectionId: string;
  index: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteLessonAction(lesson.id);
      if (result.success) {
        toast.success("Lesson deleted");
        router.refresh();
      } else {
        toast.error("Could not delete");
      }
    });
  };

  if (editing) {
    return (
      <LessonForm
        sectionId={sectionId}
        lesson={lesson}
        onClose={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

   return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 hover:border-slate-700 transition-colors">
        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {lesson.title}
            </p>
            {lesson.isFree && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Free
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
            {lesson.duration != null && lesson.duration > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatDuration(lesson.duration)}
              </span>
            )}
            {lesson.videoUrl && (
              <span className="flex items-center gap-0.5">
                <Video className="w-3 h-3" /> Video
              </span>
            )}
            {!lesson.videoUrl && (
              <span className="text-amber-500/60">No video</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Attachments — outside the flex row */}
      <div className="pl-8">
        <LessonAttachments lessonId={lesson.id} attachments={lesson.attachments} />
      </div>
    </div>
  );
}

// ─── Lesson Form (Add/Edit) ─────────────────────────────────────

function LessonForm({
  sectionId,
  lesson,
  onClose,
  onSuccess,
}: {
  sectionId: string;
  lesson?: Lesson;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "");
  const [durationMin, setDurationMin] = useState(
    lesson?.duration ? Math.round(lesson.duration / 60) : 0
  );
  const [isFree, setIsFree] = useState(lesson?.isFree ?? false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!lesson;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      sectionId,
      title: title.trim(),
      description: description.trim() || undefined,
      videoUrl: videoUrl.trim() || "",
      duration: durationMin > 0 ? durationMin * 60 : undefined,
      isFree,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateLessonAction({ lessonId: lesson.id, ...payload })
        : await createLessonAction(payload);

    if (!result.success) {
  setError(result.error ?? "Something went wrong");
  return;
}

      toast.success(isEdit ? "Lesson updated" : "Lesson created");
      onSuccess();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-slate-900 border border-indigo-500/30 p-4 space-y-3"
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Lesson title"
        disabled={isPending}
        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        disabled={isPending}
        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Video URL (YouTube/Vimeo or direct MP4)"
          disabled={isPending}
          className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={600}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
            disabled={isPending}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
            placeholder="Duration"
          />
          <span className="text-xs text-slate-500 shrink-0">min</span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
          disabled={isPending}
          className="accent-indigo-500"
        />
        Free preview (visible without enrollment)
      </label>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || title.trim().length < 2}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isEdit ? "Save Changes" : "Create Lesson"}
        </button>
      </div>
    </form>
  );
}