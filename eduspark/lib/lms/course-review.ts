// eduspark/lib/lms/course-review.ts
//
// Shared rules for the course review gate (Competency-Verified Authorization).
//
// Lifecycle:  DRAFT ──submit──▶ PENDING_REVIEW ──approve (admin)──▶ PUBLISHED
//                 ▲                  │
//                 └──── reject / withdraw ◀──┘          PUBLISHED ──unpublish──▶ DRAFT
//
// WHY: a certificate proves competency only if the quiz behind it was vetted.
// Without a reviewer, a creator could publish a trivial quiz and mint certificates
// (and therefore CREATOR roles) for an accomplice. Only an ADMIN can publish.

import { db } from "@/lib/db";
import { QUIZ_MIN_QUESTIONS_FOR_CERTIFICATION } from "@/lib/lms/quiz-policy";

export type CourseReadinessError = "CANNOT_PUBLISH_EMPTY_COURSE" | "QUIZ_TOO_SHORT";

/**
 * Objective pre-conditions for a course to enter review / be published.
 * (The admin's judgement on quality comes on top of these.)
 */
export async function checkCourseReadiness(
  courseId: string
): Promise<CourseReadinessError | null> {
  const lessonCount = await db.lesson.count({ where: { section: { courseId } } });
  if (lessonCount === 0) return "CANNOT_PUBLISH_EMPTY_COURSE";

  const quiz = await db.quiz.findUnique({
    where: { courseId },
    select: {
      _count: { select: { questions: { where: { status: "PUBLISHED" } } } },
    },
  });
  // A course without a quiz grants no certificate, so it is allowed.
  // A course WITH a quiz must meet the minimum size.
  const published = quiz?._count.questions ?? 0;
 // Every published course grants a certificate, so it MUST have a vetted quiz.
if (published < QUIZ_MIN_QUESTIONS_FOR_CERTIFICATION) {
  return "QUIZ_TOO_SHORT";
}
  return null;
}

/**
 * The quiz is the certification promise. After a course leaves DRAFT (under review,
 * published, archived) only an admin may change it — otherwise a creator could get
 * a strong quiz approved and then weaken it, or add one after approval.
 * To edit, the creator unpublishes (back to DRAFT) and resubmits for review.
 */
export function canEditQuiz(courseStatus: string, isAdmin: boolean): boolean {
  return isAdmin || courseStatus === "DRAFT";
}
