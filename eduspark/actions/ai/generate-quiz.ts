"use server";

import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GenerateQuizSchema = z.object({
  courseId: z.string().cuid(),
  questionCount: z.number().int().min(3).max(15).default(5),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
});

export type GenerateQuizInput = z.infer<typeof GenerateQuizSchema>;

// تحقّق صارم من شكل استجابة النموذج اللغوي قبل أي ثقة بمحتواها
const LlmQuestionSchema = z
  .object({
    text: z.string().min(10).max(500),
    options: z.array(z.string().min(1).max(150)).length(4),
    correctOption: z.string(),
    explanation: z.string().min(10).max(500),
  })
  .refine((q) => q.options.includes(q.correctOption), {
    message: "correctOption must exactly match one of the provided options.",
  });

const LlmResponseSchema = z.object({
  questions: z.array(LlmQuestionSchema),
});

export type GenerateQuizResult =
  | { success: true; draftedCount: number; quizId: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "COURSE_NOT_FOUND"
        | "LLM_RESPONSE_INVALID"
        | "SERVER_ERROR";
    };

// ─── Prompt construction ───────────────────────────────────────────────────────

function buildPrompt(
  courseTitle: string,
  courseDescription: string,
  lessonTitles: string[],
  questionCount: number,
  difficulty: string
): string {
  return `You are an expert instructional designer creating a certification quiz for an online course.

Course title: ${courseTitle}
Course description: ${courseDescription}
Lesson topics covered: ${lessonTitles.join(", ")}

Generate exactly ${questionCount} multiple-choice questions at ${difficulty} difficulty that test genuine conceptual understanding of the material, not trivial recall. Each question must have exactly 4 plausible options, with exactly one correct answer, and a brief explanation justifying the correct choice.

Respond with ONLY valid JSON, no markdown code fences, no preamble text, in this exact shape:
{
  "questions": [
    {
      "text": "...",
      "options": ["...", "...", "...", "..."],
      "correctOption": "... (must exactly match one of the four options verbatim)",
      "explanation": "..."
    }
  ]
}`;
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function generateQuizDraftAction(
  rawInput: GenerateQuizInput
): Promise<GenerateQuizResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const { id: userId, role } = session.user;

    const parsed = GenerateQuizSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { courseId, questionCount, difficulty } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        creatorId: true,
        sections: { select: { lessons: { select: { title: true } } } },
        quiz: { select: { id: true } },
      },
    });

    if (!course) return { success: false, error: "COURSE_NOT_FOUND" };

    // فقط منشئ المقرر نفسه (أو الإدارة) يستطيع توليد مسودّات أسئلة له
    if (course.creatorId !== userId && role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    const lessonTitles = course.sections.flatMap((s) => s.lessons.map((l) => l.title));

    const prompt = buildPrompt(
      course.title,
      course.description,
      lessonTitles,
      questionCount,
      difficulty
    );

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    let parsedLlmOutput: unknown;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsedLlmOutput = JSON.parse(cleaned);
    } catch {
      return { success: false, error: "LLM_RESPONSE_INVALID" };
    }

    const validated = LlmResponseSchema.safeParse(parsedLlmOutput);
    if (!validated.success || validated.data.questions.length === 0) {
      return { success: false, error: "LLM_RESPONSE_INVALID" };
    }

    const quiz =
      course.quiz ??
      (await db.quiz.create({
        data: { title: `${course.title} — Certification Quiz`, courseId },
        select: { id: true },
      }));

    const existingCount = await db.question.count({ where: { quizId: quiz.id } });

    // ── الخطوة الحاسمة: كل سؤال مولَّد آلياً يدخل بحالة AI_DRAFTED فقط ──────
    await db.question.createMany({
      data: validated.data.questions.map((q, index) => ({
        quizId: quiz.id,
        text: q.text,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        order: existingCount + index + 1,
        status: "AI_DRAFTED",
        generatedBy: "AI",
      })),
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/quiz`);

    return { success: true, draftedCount: validated.data.questions.length, quizId: quiz.id };
  } catch (error) {
    console.error("[GENERATE_QUIZ_DRAFT_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}