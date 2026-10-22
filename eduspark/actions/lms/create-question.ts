"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

const CreateQuestionSchema = z
  .object({
    courseId: z.string().cuid(),
    text: z.string().min(10, "Question is too short"),
    options: z.array(z.string().min(1, "Option cannot be empty")).length(4, "Must provide exactly 4 options"),
    correctOption: z.string(),
    explanation: z.string().min(5, "Explanation is too short"),
  })
  .refine((data) => data.options.includes(data.correctOption), {
    message: "Correct answer must match one of the 4 options",
  });

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export async function createQuestionAction(rawInput: CreateQuestionInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const { id: userId, role } = session.user;

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

    const quiz = course.quiz ?? (await db.quiz.create({ data: { title: `Certification Quiz`, courseId } }));
    const count = await db.question.count({ where: { quizId: quiz.id } });

    await db.question.create({
      data: {
        quizId: quiz.id,
        text,
        options,
        correctOption,
        explanation,
        order: count + 1,
        status: "PUBLISHED",
        generatedBy: "MANUAL",
      },
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/quiz`);
    return { success: true };
  } catch (error) {
    console.error("[CREATE_QUESTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}