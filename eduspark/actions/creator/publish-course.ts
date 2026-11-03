"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role, CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  courseId: z.string().cuid(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

// Two-tier quiz quality policy:
// - HARD_BLOCK: cannot publish below this threshold (prevents empty quizzes)
// - SOFT_WARN:  publishes, but logs a recommendation for admin awareness
//   (full policy: 10 questions + admin review — Future Work)
const QUIZ_MIN_QUESTIONS_HARD_BLOCK = 4;
const QUIZ_MIN_QUESTIONS_SOFT_WARN = 10;

export async function updateCourseStatusAction(
  raw: z.infer<typeof Schema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const user = await getFreshUser(session.user.id);
    if (!user?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (user.role !== Role.CREATOR && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    const { courseId, status } = Schema.parse(raw);

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true, slug: true },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };
    if (course.creatorId !== session.user.id && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    // Guards run only when publishing (not on draft transitions)
    if (status === "PUBLISHED") {
      // Guard 1: cannot publish an empty course
      const lessonCount = await db.lesson.count({
        where: { section: { courseId } },
      });
      if (lessonCount === 0) {
        return { success: false, error: "CANNOT_PUBLISH_EMPTY_COURSE" };
      }

      // Guard 2: quiz quality policy (two-tier)
      const quiz = await db.quiz.findUnique({
        where: { courseId },
        select: {
          _count: {
            select: { questions: { where: { status: "PUBLISHED" } } },
          },
        },
      });

      const publishedQuestions = quiz?._count.questions ?? 0;

      if (publishedQuestions > 0 && publishedQuestions < QUIZ_MIN_QUESTIONS_HARD_BLOCK) {
        return { success: false, error: "QUIZ_TOO_SHORT" };
      }

      if (publishedQuestions > 0 && publishedQuestions < QUIZ_MIN_QUESTIONS_SOFT_WARN) {
        console.warn(
          `[PUBLISH_COURSE] Course ${courseId} published with only ${publishedQuestions} ` +
          `published quiz questions. Recommended: ${QUIZ_MIN_QUESTIONS_SOFT_WARN}+ for certification quality.`
        );
      }
    }

    await db.course.update({
      where: { id: courseId },
      data: { status: status as CourseStatus },
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    revalidatePath(`/dashboard/creator/courses`);
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath(`/courses`);
    return { success: true };
  } catch (e) {
    console.error("[UPDATE_COURSE_STATUS]", e);
    return { success: false, error: "SERVER_ERROR" };
  }
}