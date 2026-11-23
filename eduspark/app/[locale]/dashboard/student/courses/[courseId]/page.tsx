import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale } from "next-intl/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCourseAction } from "@/actions/lms/get-course";
import { CourseLearningView } from "./_components/course-learning-view";
import { db } from "@/lib/db";

interface CoursePageProps {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}

export async function generateMetadata({ params }: CoursePageProps) {
  const { courseId } = await params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  return {
    title: course ? `${course.title} — EduSpark` : "Course — EduSpark",
  };
}

export default async function CoursePage({
  params,
  searchParams,
}: CoursePageProps) {
  const session = await getServerSession(authOptions);
  const locale = await getLocale();

  if (!session?.user) {
    redirect(`/${locale}/auth/login`);
  }

  const { courseId } = await params;
  const { lessonId } = await searchParams;

  const result = await getCourseAction(courseId);

  if (!result.success) {
    if (result.error === "UNAUTHORIZED") redirect(`/${locale}/auth/login`);
    if (result.error === "NOT_ENROLLED")
      redirect(`/${locale}/courses/${courseId}?error=not-enrolled`);
    notFound();
  }

  const { data: course } = result;

  const hasQuiz = !!(await db.quiz.findUnique({
    where: { courseId },
    select: { id: true },
  }));

  const allLessonIds = course.sections.flatMap((s) =>
    s.lessons.map((l) => l.id)
  );

  const queriedLessonId =
    lessonId && allLessonIds.includes(lessonId) ? lessonId : null;

  const initialLessonId =
    queriedLessonId ??
    course.firstUncompletedLessonId ??
    course.sections[0]?.lessons?.[0]?.id ??
    null;

  if (!initialLessonId) notFound();

  return (
    <CourseLearningView
      course={course}
      initialLessonId={initialLessonId}
      hasQuiz={hasQuiz}
    />
  );
}