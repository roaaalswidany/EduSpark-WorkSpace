import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  EnrolledCourseCard,
  type EnrolledCourse,
} from "./_components/enrolled-course-card";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentCourses.page" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function MyCoursesPage() {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations("studentCourses.page");

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
            select: { id: true, name: true, headline: true },
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <BookOpen className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t("eyebrow")}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
          {t("title")}
        </h1>
        {totalCount > 0 ? (
          <p className="text-sm text-muted-foreground mt-2">
            <span className="text-primary font-semibold">{inProgressCount}</span>{" "}
            <span className="text-muted-foreground">قيد التقدم ·</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {completedCount}
            </span>{" "}
            <span className="text-muted-foreground">مكتملة ·</span>{" "}
            <span className="text-foreground font-semibold">{totalCount}</span>{" "}
            <span className="text-muted-foreground">إجمالي</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            {t("noEnrollments")}
          </p>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1.5">
            {t("emptyTitle")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
            {t("emptyDesc")}
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <Search className="w-4 h-4" />
            {t("browseCourses")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {courses.map((course) => (
            <EnrolledCourseCard key={course.enrollmentId} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}