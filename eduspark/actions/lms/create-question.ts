"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { getFreshUser } from "@/lib/security/fresh-user";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { revalidatePath } from "next/cache";

const CreateQuestionSchema = z
  .object({
    courseId: z.string().cuid(),
    // Upper bounds mirror the AI generator's limits (see actions/ai/generate-quiz.ts)
    text: z.string().trim().min(10, "Question is too short").max(500, "Question is too long (max 500)"),
    options: z
      .array(z.string().trim().min(1, "Option cannot be empty").max(150, "Option is too long (max 150)"))
      .length(4, "Must provide exactly 4 options"),
    correctOption: z.string().trim().max(150),
    explanation: z.string().trim().min(5, "Explanation is too short").max(500, "Explanation is too long (max 500)"),
  })
  .refine((data) => data.options.includes(data.correctOption), {
    message: "Correct answer must match one of the 4 options",
  });

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export async function createQuestionAction(rawInput: CreateQuestionInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    // Authoritative role/status from the DB — the JWT role can be 30 days stale.
    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    const role = actor.role;

    if ((await limitByUser(RateLimits.QUESTION_CREATE, userId)) !== null) {
      return { success: false, error: "RATE_LIMITED" };
    }

    const parsed = CreateQuestionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { courseId, text, options, correctOption, explanation } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true, quiz: true },
    });

    if (!course) return { success: false, error: "COURSE_NOT_FOUND" };
    if (course.creatorId !== userId && role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    // ON CONFLICT DO NOTHING + read: race-safe lazy creation (courseId is unique).
    await db.quiz.createMany({
      data: [{ title: "Certification Quiz", courseId }],
      skipDuplicates: true,
    });
    const quiz = await db.quiz.findUniqueOrThrow({ where: { courseId }, select: { id: true } });

    // Serialize concurrent additions for THIS quiz (row lock), so `order` is unique.
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${quiz.id} FOR UPDATE`;
      const last = await tx.question.aggregate({ where: { quizId: quiz.id }, _max: { order: true } });
      await tx.question.create({
        data: {
          quizId: quiz.id,
          text,
          options,
          correctOption,
          explanation,
          order: (last._max.order ?? 0) + 1,
          status: "PUBLISHED",
          generatedBy: "MANUAL",
        },
      });
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/quiz`);
    return { success: true };
  } catch (error) {
    console.error("[CREATE_QUESTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}