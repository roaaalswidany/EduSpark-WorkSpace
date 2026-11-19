import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { QuizView } from "./_components/quiz-view";

interface QuizPageProps {
  params: Promise<{ courseId: string }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = session.user.id;

  // ── Verify enrollment + fetch quiz + course in parallel ────
  const [enrollment, quiz, course] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, isPassed: true },
    }),
    db.quiz.findUnique({
      where: { courseId },
      select: {
        id: true,
        title: true,
        description: true,
        passingScore: true,
        timeLimit: true,
        questions: {
          where: { status: "PUBLISHED" },
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            options: true,
            order: true,
          },
        },
      },
    }),
    db.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, slug: true },
    }),
  ]);

  if (!course) notFound();
if (!enrollment) redirect(`/courses/${course.slug}?error=not-enrolled`);
if (!quiz || quiz.questions.length === 0) notFound();

  // ── Fetch most recent attempt ──────────────────────────────
  const lastAttempt = await db.quizAttempt.findFirst({
    where: { userId, quizId: quiz.id },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      score: true,
      passed: true,
      correctQ: true,
      totalQ: true,
      submittedAt: true,
    },
  });

  return (
    <QuizView
      quiz={{
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options as string[],
          order: q.order,
        })),
        totalQuestions: quiz.questions.length,
      }}
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
      }}
      lastAttempt={
        lastAttempt
          ? {
              score: lastAttempt.score,
              passed: lastAttempt.passed,
              correctQ: lastAttempt.correctQ,
              totalQ: lastAttempt.totalQ,
              submittedAt: lastAttempt.submittedAt,
            }
          : null
      }
      alreadyPassed={enrollment.isPassed}
    />
  );
}