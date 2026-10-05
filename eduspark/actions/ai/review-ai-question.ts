"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

const ReviewSchema = z.object({
  questionId: z.string().cuid(),
  decision: z.enum(["APPROVE", "REJECT"]),
  editedText: z.string().min(10).max(500).optional(),
});

export type ReviewAiQuestionResult =
  | { success: true; status: "PUBLISHED" | "REJECTED" }
  | {
      success: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "SERVER_ERROR";
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
        quiz: { select: { course: { select: { creatorId: true } } } },
      },
    });

    if (!question) return { success: false, error: "NOT_FOUND" };

    if (
      question.quiz.course.creatorId !== session.user.id &&
      session.user.role !== Role.ADMIN
    ) {
      return { success: false, error: "FORBIDDEN" };
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