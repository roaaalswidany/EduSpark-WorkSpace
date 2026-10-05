import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  EnrolledCourseCard,
  type EnrolledCourse,
} from "./_components/enrolled-course-card";

export default async function MyCoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  // ── Fetch enrolled courses ─────────────────────────────
  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      progress: true,
      isPassed: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnail: true,
          level: true,
          creator: {
            select: { id: true, name: true, image: true, headline: true },
          },
          category: { select: { id: true, name: true, slug: true } },
          sections: {
            select: {
              lessons: { select: { id: true, duration: true } },
            },
          },
        },
      },
    },
  });

  // ── Shape data ─────────────────────────────────────────
  const courses: EnrolledCourse[] = enrollments.map((e) => {
    const totalLessons = e.course.sections.reduce(
      (sum, s) => sum + s.lessons.length,
      0
    );
    const totalDuration = e.course.sections.reduce(
      (sum, s) =>
        sum + s.lessons.reduce((ls, l) => ls + (l.duration ?? 0), 0),
      0
    );

    return {
      enrollmentId: e.id,
      courseId: e.course.id,
      courseSlug: e.course.slug,
      title: e.course.title,
      description: e.course.description,
      thumbnail: e.course.thumbnail,
      level: e.course.level,
      category: e.course.category,
      creator: e.course.creator,
      totalLessons,
      totalDuration,
      progress: e.progress,
      isPassed: e.isPassed,
      enrolledAt: e.createdAt,
      lastActivityAt: e.updatedAt,
      completedAt: e.completedAt,
    };
  });

  const inProgressCount = courses.filter((c) => !c.isPassed).length;
  const completedCount = courses.filter((c) => c.isPassed).length;
  const totalCount = courses.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <BookOpen className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">My Learning</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          My Courses
        </h1>
        {totalCount > 0 ? (
          <p className="text-sm text-slate-500 mt-2">
            <span className="text-indigo-400 font-semibold">
              {inProgressCount}
            </span>{" "}
            in progress ·{" "}
            <span className="text-emerald-400 font-semibold">
              {completedCount}
            </span>{" "}
            completed ·{" "}
            <span className="text-slate-300 font-semibold">{totalCount}</span>{" "}
            total
          </p>
        ) : (
          <p className="text-sm text-slate-500 mt-2">
            You haven&apos;t enrolled in any course yet.
          </p>
        )}
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
      {totalCount === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            Start your learning journey
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            Browse our catalog of expert-led courses and enroll in your first
            course to get started.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <Search className="w-4 h-4" />
            Browse Courses
          </Link>
        </div>
      ) : (
        /* ── Courses grid ──────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {courses.map((course) => (
            <EnrolledCourseCard key={course.enrollmentId} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}