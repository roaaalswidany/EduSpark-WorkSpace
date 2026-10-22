"use server";

import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Gemini Client (lazy init) ────────────────────────────────────

const MODEL_NAME = "gemini-3.8-flash";
const MAX_OUTPUT_TOKENS = 2500;

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[GENERATE_QUIZ] GEMINI_API_KEY not set");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 30_000 },
    });
  }
  return aiClient;
}

// ─── Schemas ──────────────────────────────────────────────────────

const GenerateQuizSchema = z.object({
  courseId: z.string().cuid(),
  questionCount: z.number().int().min(3).max(15).default(5),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
});

export type GenerateQuizInput = z.infer<typeof GenerateQuizSchema>;

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
        | "GEMINI_NOT_CONFIGURED"
        | "LLM_RESPONSE_INVALID"
        | "RATE_LIMITED"
        | "SERVER_ERROR";
    };

// ─── Prompt construction ─────────────────────────────────────────

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

Respond with ONLY valid JSON in this exact shape:
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

// ─── Action ──────────────────────────────────────────────────────

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

    // Only the course creator (or admin) can generate quiz drafts
    if (course.creatorId !== userId && role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    const client = getClient();
    if (!client) {
      return { success: false, error: "GEMINI_NOT_CONFIGURED" };
    }

    const lessonTitles = course.sections.flatMap((s) =>
      s.lessons.map((l) => l.title)
    );

    const prompt = buildPrompt(
      course.title,
      course.description,
      lessonTitles,
      questionCount,
      difficulty
    );

    // ─── Call Gemini with guaranteed JSON output ──────────────────
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text ?? "";
    if (!rawText.trim()) {
      return { success: false, error: "LLM_RESPONSE_INVALID" };
    }

    // Gemini with responseMimeType: "application/json" should return
    // pure JSON, but we strip code fences defensively just in case.
    let parsedLlmOutput: unknown;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      parsedLlmOutput = JSON.parse(cleaned);
    } catch {
      console.error(
        "[GENERATE_QUIZ] JSON parse failed. Preview:",
        rawText.slice(0, 300)
      );
      return { success: false, error: "LLM_RESPONSE_INVALID" };
    }

    const validated = LlmResponseSchema.safeParse(parsedLlmOutput);
    if (!validated.success || validated.data.questions.length === 0) {
      console.error(
        "[GENERATE_QUIZ] Validation failed:",
        validated.success ? "empty" : validated.error.flatten()
      );
      return { success: false, error: "LLM_RESPONSE_INVALID" };
    }

    const quiz =
      course.quiz ??
      (await db.quiz.create({
        data: { title: `${course.title} — Certification Quiz`, courseId },
        select: { id: true },
      }));

    const existingCount = await db.question.count({ where: { quizId: quiz.id } });

    // AI-generated questions enter with status AI_DRAFTED only —
    // they must be reviewed and published by a human before use.
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

    return {
      success: true,
      draftedCount: validated.data.questions.length,
      quizId: quiz.id,
    };
  } catch (error) {
    console.error("[GENERATE_QUIZ_DRAFT_ACTION]", error);

    const message = error instanceof Error ? error.message : "";
    if (message.includes("429") || message.toLowerCase().includes("rate")) {
      return { success: false, error: "RATE_LIMITED" };
    }

    return { success: false, error: "SERVER_ERROR" };
  }
}