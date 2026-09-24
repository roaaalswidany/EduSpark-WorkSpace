/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

// ─── Credential ID Generator ──────────────────────────────────────────────────
// Format: EDU-<BASE36_TIMESTAMP>-<RANDOM_HEX> — human-readable, URL-safe, unique

function generateCredentialId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(16).substring(2, 9).toUpperCase();
  return `EDU-${ts}-${rand}`;
}

// ─── Schemas & Types ──────────────────────────────────────────────────────────

const AnswerSchema = z.object({
  questionId: z.string().cuid("Each questionId must be a valid CUID."),
  selectedOption: z
    .string()
    .min(1, "selectedOption cannot be empty.")
    .max(100, "selectedOption is too long."),
});

const SubmitQuizSchema = z.object({
  quizId: z.string().cuid("Invalid quizId."),
  answers: z
    .array(AnswerSchema)
    .min(1, "At least one answer is required.")
    .refine(
      (arr) => new Set(arr.map((a) => a.questionId)).size === arr.length,
      { message: "Duplicate questionId entries are not allowed." }
    ),
});

export type SubmitQuizInput = z.infer<typeof SubmitQuizSchema>;

export interface AnswerFeedback {
  questionId: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export interface SubmitQuizSuccess {
  attemptId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  passingScore: number;
  roleUpgraded: boolean;
  certificate: {
    id: string;
    credentialId: string;
    issuedAt: Date;
    courseId: string;
  } | null;
  answerFeedback: AnswerFeedback[];
}

export type SubmitQuizResult =
  | { success: true; data: SubmitQuizSuccess }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "QUIZ_NOT_FOUND"
        | "NOT_ENROLLED"
        | "QUESTION_COUNT_MISMATCH"
        | "INVALID_QUESTION_IDS"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<string, string[]>>;
    };

// ─── Server Action ────────────────────────────────────────────────────────────

export async function submitQuizAction(
  rawInput: SubmitQuizInput
): Promise<SubmitQuizResult> {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    // ── 2. Validate input ────────────────────────────────────────────────────
    const parsed = SubmitQuizSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { quizId, answers } = parsed.data;

    // ── 3. Fetch quiz + questions (server-side only — correctOption never
    //       reaches the client in any form until after grading) ───────────────
    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        passingScore: true,
        courseId: true,
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            correctOption: true,
            explanation: true,
          },
        },
      },
    });

    if (!quiz) return { success: false, error: "QUIZ_NOT_FOUND" };

    const { courseId, passingScore, questions } = quiz;

    // ── 4. Verify enrollment ─────────────────────────────────────────────────
    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });

    if (!enrollment) return { success: false, error: "NOT_ENROLLED" };

    // ── 5. Structural validation: all questions answered, no alien IDs ───────
    const canonicalIds = new Set(questions.map((q) => q.id));
    const submittedIds = new Set(answers.map((a) => a.questionId));

    if (submittedIds.size !== canonicalIds.size) {
      return { success: false, error: "QUESTION_COUNT_MISMATCH" };
    }

    for (const id of submittedIds) {
      if (!canonicalIds.has(id)) {
        return { success: false, error: "INVALID_QUESTION_IDS" };
      }
    }

    // ── 6. Server-side grading ────────────────────────────────────────────────
    const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOption]));

    const gradedAnswers = questions.map((q) => ({
  questionId: q.id,
  selectedOption: answerMap.get(q.id)!,
  correctOption: q.correctOption ?? "",
  isCorrect: answerMap.get(q.id) === q.correctOption,
}));

const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
    const totalQ = questions.length;
    const rawScore = totalQ > 0 ? (correctCount / totalQ) * 100 : 0;
    const score = Math.round(rawScore * 100) / 100; // 2 decimal places
    const passed = score >= passingScore;

    // ── 7. Atomic transaction: attempt + answers + (cert + role upgrade) ──────
    //
    //   Thread-safety guarantees:
    //   ① $transaction wraps all writes atomically — partial commits are
    //     impossible.
    //   ② certificate.upsert with @@unique([userId, courseId]) is idempotent —
    //     concurrent requests both "succeed" but only one row is ever created.
    //   ③ user.updateMany with `where: { role: STUDENT }` is a conditional
    //     write — if role was already CREATOR (from a concurrent request that
    //     beat us), count === 0 and we silently skip. No double-upgrade.
    //   ④ PostgreSQL's statement-level atomicity within $transaction ensures
    //     the role upgrade and certificate are always co-committed or
    //     co-rolled-back — the two are never orphaned from each other.

    const txResult = await db.$transaction(async (tx) => {
      // ① Persist the attempt
      const attempt = await tx.quizAttempt.create({
        data: {
          userId,
          quizId,
          courseId,
          score,
          passed,
          totalQ,
          correctQ: correctCount,
        },
        select: { id: true, submittedAt: true },
      });

      // ② Persist individual answers
      await tx.quizAnswer.createMany({
        data: gradedAnswers.map((a: { questionId: any; selectedOption: any; isCorrect: any; }) => ({
          attemptId: attempt.id,
          questionId: a.questionId,
          selectedOption: a.selectedOption,
          isCorrect: a.isCorrect,
        })),
        skipDuplicates: true,
      });

      if (!passed) {
        return { attempt, certificate: null, roleUpgraded: false };
      }

      // ③ Issue certificate — idempotent via unique constraint on [userId, courseId]
      const certificate = await tx.certificate.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: {
          userId,
          courseId,
          attemptId: attempt.id,
          score,
          credentialId: generateCredentialId(),
        },
        update: {},
        select: {
          id: true,
          credentialId: true,
          issuedAt: true,
          courseId: true,
        },
      });

      // ④ Conditional role upgrade: guard prevents double-escalation across
      //    concurrent transactions. updateMany returns { count: 0 } if the
      //    row no longer matches the WHERE clause — safe, silent, correct.
      const { count: upgraded } = await tx.user.updateMany({
        where: {
          id: userId,
          role: Role.STUDENT,
        },
        data: {
          role: Role.CREATOR,
        },
      });

      return {
        attempt,
        certificate,
        roleUpgraded: upgraded > 0,
      };
    });

    // ── 8. Revalidate affected paths ─────────────────────────────────────────
    revalidatePath(`/dashboard/student/courses/${courseId}`);
    if (txResult.roleUpgraded) {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/creator");
    }

    return {
      success: true,
      data: {
        attemptId: txResult.attempt.id,
        score,
        totalQuestions: totalQ,
        correctAnswers: correctCount,
        passed,
        passingScore,
        roleUpgraded: txResult.roleUpgraded,
        certificate: txResult.certificate
          ? {
              id: txResult.certificate.id,
              credentialId: txResult.certificate.credentialId,
              issuedAt: txResult.certificate.issuedAt,
              courseId: txResult.certificate.courseId,
            }
          : null,
        // Full feedback always returned — this is a learning platform.
        // Showing correct answers promotes genuine understanding.
        answerFeedback: gradedAnswers.map(({ questionId, selectedOption, correctOption, isCorrect }) => ({
          questionId,
          selectedOption,
          correctOption,
          isCorrect,
        })),
      },
    };
  } catch (error) {
    console.error("[SUBMIT_QUIZ_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}