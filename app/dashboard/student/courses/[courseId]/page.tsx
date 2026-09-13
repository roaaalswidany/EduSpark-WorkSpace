import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCourseAction } from "@/app/actions/lms/get-course";
import { CourseLearningView } from "@/app/dashboard/student/courses/[courseId]/_components/course-learning-view";

interface CoursePageProps {
  params: { courseId: string };
  searchParams: { lessonId?: string };
}

export default async function CoursePage({
  params,
  searchParams,
}: CoursePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const result = await getCourseAction(params.courseId);

  if (!result.success) {
    if (result.error === "UNAUTHORIZED") redirect("/auth/login");
    if (result.error === "NOT_ENROLLED")
      redirect(`/courses/${params.courseId}?error=not-enrolled`);
    notFound();
  }

  const { data: course } = result;

  // Lesson selection priority:
  //  1. URL query param (restore from navigation)
  //  2. First uncompleted lesson (natural resume)
  //  3. First lesson of first section (fresh start)
  const allLessonIds = course.sections.flatMap((s) =>
    s.lessons.map((l) => l.id)
  );

  const queriedLessonId =
    searchParams.lessonId && allLessonIds.includes(searchParams.lessonId)
      ? searchParams.lessonId
      : null;

  const initialLessonId =
    queriedLessonId ??
    course.firstUncompletedLessonId ??
    course.sections[0]?.lessons[0]?.id ??
    null;

  if (!initialLessonId) notFound();

  return (
    <CourseLearningView course={course} initialLessonId={initialLessonId} />
  );
}