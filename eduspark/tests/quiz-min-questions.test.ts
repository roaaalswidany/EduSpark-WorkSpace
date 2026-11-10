import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createQuestionAction } from "@/actions/lms/create-question";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { QUIZ_MIN_QUESTIONS_FOR_CERTIFICATION as MIN } from "@/lib/lms/quiz-policy";
import { resetDatabase, createUser, createCategory, createCourseWithQuiz, enroll } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

beforeEach(async () => { await resetDatabase(); resetSession(); });

async function attempt(courseId: string, studentId: string, option: string) {
  const quiz = await db.quiz.findUniqueOrThrow({ where: { courseId }, include: { questions: true } });
  actAs({ id: studentId, role: "STUDENT" });
  return submitQuizAction({
    quizId: quiz.id,
    answers: quiz.questions.map((x) => ({ questionId: x.id, selectedOption: option })),
  });
}

describe("certification requires a minimum quiz size", () => {
  it("a quiz with fewer than MIN questions can never certify or promote", async () => {
    const creator = await createUser("CREATOR");
    const course = await createCourseWithQuiz({ creatorId: creator.id, categoryId: (await createCategory()).id, questions: MIN - 1 });
    const student = await createUser("STUDENT"); await enroll(student.id, course.id, { isPassed: true });    const res = await attempt(course.id, student.id, "A");
    expect(res.success).toBe(false);
    expect(await db.certificate.count({ where: { userId: student.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).role).toBe("STUDENT");
  });

  it("bypass attempt: a published course cannot get a quiz added afterwards", async () => {
    const creator = await createUser("CREATOR");
    const slug = `bare-${Date.now()}`;
    const course = await db.course.create({
      data: { title: slug, slug, description: "d", price: 0, status: "PUBLISHED", creatorId: creator.id },
    });
    actAs({ id: creator.id, role: "CREATOR" });
    const res = await createQuestionAction({
      courseId: course.id, text: "What does concept one describe?",
      options: ["right", "w1", "w2", "w3"], correctOption: "right", explanation: "Because it is the right one.",
    });
    expect(res).toMatchObject({ success: false, error: "COURSE_LOCKED" });
    expect(await db.question.count()).toBe(0);
    expect(await db.certificate.count()).toBe(0);
  });

  it("a quiz with exactly MIN questions still certifies", async () => {
    const creator = await createUser("CREATOR");
    const course = await createCourseWithQuiz({ creatorId: creator.id, categoryId: (await createCategory()).id, questions: MIN });
    const student = await createUser("STUDENT"); await enroll(student.id, course.id, { isPassed: true });    const res = await attempt(course.id, student.id, "A");
    expect(res.success && res.data.passed).toBe(true);
  });
});