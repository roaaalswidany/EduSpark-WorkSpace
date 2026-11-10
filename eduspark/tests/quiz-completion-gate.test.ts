import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
}));

describe("quiz completion gate — server-side enforcement", () => {
  let userId: string;
  let courseId: string;
  let quizId: string;
  let questionIds: string[];

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 1. User
    const user = await db.user.create({
      data: {
        email: `qg-${stamp}@test.local`,
        name: "Quiz Gate Test",
        role: "STUDENT",
        isActive: true,
        emailVerified: new Date(),
        password: "hashed-irrelevant",
      },
    });
    userId = user.id;

    // 2. Course (published) — separate call
    const course = await db.course.create({
      data: {
        title: `Quiz Gate Course ${stamp}`,
        slug: `quiz-gate-${stamp}`,
        description: "Test course",
        price: 0,
        level: "BEGINNER",
        status: "PUBLISHED",
        creatorId: userId,
        tags: [],
      },
    });
    courseId = course.id;

    // 3. Quiz + 4 published questions — separate call
    //    Question has: text, options (Json), correctOption, order, status
    const quiz = await db.quiz.create({
      data: {
        title: "Quiz 1",
        passingScore: 80,
        courseId,
        questions: {
          create: Array.from({ length: 4 }).map((_, i) => ({
            text: `Q${i + 1}?`,
            options: ["A", "B", "C", "D"],
            correctOption: "A",
            order: i + 1,
            status: "PUBLISHED",
          })),
        },
      },
      include: { questions: true },
    });
    quizId = quiz.id;
    questionIds = quiz.questions.map((q) => q.id);

    // 4. Enrollment (NOT passed yet) — paidAmount is required
    await db.enrollment.create({
      data: {
        userId,
        courseId,
        status: "ACTIVE",
        progress: 0,
        isPassed: false,
        paidAmount: 0,
      },
    });

    // 5. Mock session
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: userId, email: "test@test.local", role: "STUDENT" },
    } as never);
  });

  it("REJECTS quiz submission when course is not completed (isPassed=false)", async () => {
    const result = await submitQuizAction({
      quizId,
      answers: questionIds.map((qid) => ({
        questionId: qid,
        selectedOption: "A",
      })),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("COURSE_NOT_COMPLETED");
    }

    // Verify side effects did NOT happen
    const attempts = await db.quizAttempt.count({ where: { userId, quizId } });
    expect(attempts).toBe(0);

    const certs = await db.certificate.count({ where: { userId, courseId } });
    expect(certs).toBe(0);
  });

  it("ALLOWS quiz submission when course IS completed (isPassed=true)", async () => {
    await db.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { isPassed: true, status: "COMPLETED", progress: 100 },
    });

    const result = await submitQuizAction({
      quizId,
      answers: questionIds.map((qid) => ({
        questionId: qid,
        selectedOption: "A",
      })),
    });

    // Should pass the gate (may pass or fail on score, but NOT on gate)
    if (!result.success) {
      expect(result.error).not.toBe("COURSE_NOT_COMPLETED");
    }
  });
});