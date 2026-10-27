import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { QUIZ_MAX_ATTEMPTS_PER_WINDOW } from "@/lib/lms/quiz-policy";
import { resetDatabase, createUser, createCourseWithQuiz, enroll, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

type Course = Awaited<ReturnType<typeof createCourseWithQuiz>>;

const answers = (c: Course, pick: (i: number) => string) =>
  c.quiz!.questions.map((q, i) => ({ questionId: q.id, selectedOption: pick(i) }));
const allWrong = (c: Course) => answers(c, () => "B");
const allRight = (c: Course) => answers(c, () => "A");

let course: Course;
let student: Awaited<ReturnType<typeof createUser>>;

beforeAll(resetDatabase);
beforeEach(async () => {
  resetSession();
  const creator = await createUser("CREATOR");
  const cat = await createCategory();
  course = await createCourseWithQuiz({ creatorId: creator.id, categoryId: cat.id });
  student = await createUser("STUDENT");
  await enroll(student.id, course.id);
  actAs({ id: student.id, role: "STUDENT" });
});

describe("F2 — the answer key is never leaked on a failed attempt", () => {
  it("returns NO feedback when failing", async () => {
    const res = await submitQuizAction({ quizId: course.quiz!.id, answers: allWrong(course) });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.passed).toBe(false);
    expect(res.data.answerFeedback).toEqual([]);
    expect(JSON.stringify(res.data)).not.toContain('"correctOption":"A"');
  });

  it("returns the feedback only after passing", async () => {
    const res = await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    expect(res.success && res.data.passed).toBe(true);
    if (res.success) expect(res.data.answerFeedback).toHaveLength(course.quiz!.questions.length);
  });
});

describe("F2 — attempt limit (3 per 24h) until certified", () => {
  it("blocks the 4th attempt with ATTEMPT_LIMIT_REACHED + retryAt", async () => {
    for (let i = 0; i < QUIZ_MAX_ATTEMPTS_PER_WINDOW; i++) {
      const ok = await submitQuizAction({ quizId: course.quiz!.id, answers: allWrong(course) });
      expect(ok.success).toBe(true);
    }
    const blocked = await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.error).toBe("ATTEMPT_LIMIT_REACHED");
      expect(new Date(blocked.retryAt!).getTime()).toBeGreaterThan(Date.now());
    }
    expect(await db.quizAttempt.count({ where: { userId: student.id } })).toBe(QUIZ_MAX_ATTEMPTS_PER_WINDOW);
  });

  it("holds under 10 CONCURRENT submissions (row lock): never more than the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        submitQuizAction({ quizId: course.quiz!.id, answers: allWrong(course) })
      )
    );
    const stored = await db.quizAttempt.count({ where: { userId: student.id } });
    expect(stored).toBeLessThanOrEqual(QUIZ_MAX_ATTEMPTS_PER_WINDOW);
    expect(results.filter((r) => r.success).length).toBe(stored);
  });
});

describe("Competency-verified escalation", () => {
  it("passing issues ONE certificate and upgrades STUDENT → CREATOR atomically", async () => {
    const res = await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    expect(res.success && res.data.roleUpgraded).toBe(true);
    expect((await db.user.findUnique({ where: { id: student.id } }))?.role).toBe("CREATOR");
    expect(await db.certificate.count({ where: { userId: student.id, courseId: course.id } })).toBe(1);
  });

  it("concurrent passing submissions create exactly one certificate", async () => {
    await Promise.all(
      Array.from({ length: 4 }, () => submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) }))
    );
    expect(await db.certificate.count({ where: { userId: student.id, courseId: course.id } })).toBe(1);
  });

  it("an unanswered question ('' from the timer auto-submit) counts as wrong, not as an error", async () => {
    const partial = answers(course, (i) => (i === 0 ? "" : "A"));
    const res = await submitQuizAction({ quizId: course.quiz!.id, answers: partial });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.score).toBeLessThan(100);
      expect(res.data.totalQuestions).toBe(course.quiz!.questions.length);
    }
  });

  it("not enrolled → rejected", async () => {
    const stranger = await createUser("STUDENT");
    actAs({ id: stranger.id, role: "STUDENT" });
    const res = await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    expect(res.success).toBe(false);
    expect(await db.certificate.count({ where: { userId: stranger.id } })).toBe(0);
  });
});

describe("F20 — XP cannot be farmed through quiz retakes", () => {
  it("awards XP only for counted attempts; practice retakes after certification earn nothing", async () => {
    await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    await new Promise((r) => setTimeout(r, 400)); // XP is fire-and-forget
    const xpAfterFirstPass = (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ?? 0;
    expect(xpAfterFirstPass).toBeGreaterThan(0);

    for (let i = 0; i < 3; i++) await submitQuizAction({ quizId: course.quiz!.id, answers: allRight(course) });
    await new Promise((r) => setTimeout(r, 400));
    const xpAfterRetakes = (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ?? 0;
    expect(xpAfterRetakes).toBe(xpAfterFirstPass);
  });
});
