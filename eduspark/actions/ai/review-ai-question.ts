"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canEditQuiz } from "@/lib/lms/course-review";

const ReviewSchema = z.object({
  questionId: z.string().cuid(),
  decision: z.enum(["APPROVE", "REJECT"]),
  editedText: z.string().min(10).max(500).optional(),
});

export type ReviewAiQuestionResult =
  | { success: true; status: "PUBLISHED" | "REJECTED" }
  | {
      success: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "COURSE_LOCKED" | "SERVER_ERROR";
    };

export async function reviewAiQuestionAction(
  rawInput: z.infer<typeof ReviewSchema>
): Promise<ReviewAiQuestionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = ReviewSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const question = await db.question.findUnique({
      where: { id: parsed.data.questionId },
      select: {
        id: true,
        quiz: { select: { course: { select: { creatorId: true, status: true } } } },
      },
    });

    if (!question) return { success: false, error: "NOT_FOUND" };

    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    const isAdmin = actor.role === Role.ADMIN;

    if (question.quiz.course.creatorId !== session.user.id && !isAdmin) {
      return { success: false, error: "FORBIDDEN" };
    }

    // Approving publishes a question into the certification quiz → same lock as manual authoring.
    if (
      parsed.data.decision === "APPROVE" &&
      !canEditQuiz(question.quiz.course.status, isAdmin)
    ) {
      return { success: false, error: "COURSE_LOCKED" };
    }

    const newStatus = parsed.data.decision === "APPROVE" ? "PUBLISHED" : "REJECTED";

    await db.question.update({
      where: { id: parsed.data.questionId },
      data: {
        status: newStatus,
        ...(parsed.data.editedText ? { text: parsed.data.editedText } : {}),
      },
    });

    revalidatePath("/dashboard/creator/courses");

    return { success: true, status: newStatus };
  } catch (error) {
    console.error("[REVIEW_AI_QUESTION_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}