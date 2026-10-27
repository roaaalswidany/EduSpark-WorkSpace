import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createQuestionAction } from "@/actions/lms/create-question";
import { generateQuizDraftAction } from "@/actions/ai/generate-quiz";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { resetDatabase, createUser, createCategory, enroll } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

/** A course WITHOUT a quiz — the creator authors it from scratch (real app format: string options). */
async function bareCourse(creatorId: string, categoryId?: string) {
  const slug = `bare-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return db.course.create({ data: { title: slug, slug, description: "d", price: 0, status: "PUBLISHED", creatorId, ...(categoryId ? { categoryId } : {}) } });
}
const q = (i: number, over: Record<string, unknown> = {}) => ({
  courseId: "", text: `What does concept number ${i} describe?`, options: ["right", "w1", "w2", "w3"],
  correctOption: "right", explanation: "Because it is the right one.", ...over,
});

beforeEach(async () => { await resetDatabase(); resetSession(); delete process.env.GEMINI_API_KEY; });

describe("manual quiz authoring (createQuestionAction)", () => {
  it("END-TO-END: creator authors 4 questions → student passes the quiz → certificate + CREATOR upgrade", async () => {
    const creator = await createUser("CREATOR"); const course = await bareCourse(creator.id, (await createCategory()).id);
    actAs({ id: creator.id, role: "CREATOR" });
    for (let i = 1; i <= 4; i++) expect((await createQuestionAction({ ...q(i), courseId: course.id })).success).toBe(true);

    const quiz = await db.quiz.findUniqueOrThrow({ where: { courseId: course.id }, include: { questions: { orderBy: { order: "asc" } } } });
    expect(quiz.questions.map((x) => x.order)).toEqual([1, 2, 3, 4]);
    expect(quiz.questions[0]).toMatchObject({ options: ["right", "w1", "w2", "w3"], correctOption: "right", generatedBy: "MANUAL" });

    const student = await createUser("STUDENT"); await enroll(student.id, course.id);
    actAs({ id: student.id, role: "STUDENT" });
    const res = await submitQuizAction({ quizId: quiz.id, answers: quiz.questions.map((x) => ({ questionId: x.id, selectedOption: "right" })) });
    expect(res.success && res.data.passed && res.data.roleUpgraded).toBe(true);
    expect(await db.certificate.count({ where: { userId: student.id, courseId: course.id } })).toBe(1);
  });

  it("only the course owner (or an admin) may author; others and anonymous are refused", async () => {
    const owner = await createUser("CREATOR"); const other = await createUser("CREATOR"); const stu = await createUser(); const admin = await createUser("ADMIN");
    const course = await bareCourse(owner.id);
    for (const u of [other, stu]) { actAs({ id: u.id, role: u.role as never }); expect((await createQuestionAction({ ...q(1), courseId: course.id })).success).toBe(false); }
    actAs(null); expect((await createQuestionAction({ ...q(1), courseId: course.id })).success).toBe(false);
    actAs({ id: admin.id, role: "ADMIN" }); expect((await createQuestionAction({ ...q(1), courseId: course.id })).success).toBe(true);
    expect(await db.question.count()).toBe(1);
  });

  it("a suspended or demoted owner with a still-valid JWT is refused", async () => {
    const owner = await createUser("CREATOR"); const course = await bareCourse(owner.id);
    actAs({ id: owner.id, role: "CREATOR" });
    await db.user.update({ where: { id: owner.id }, data: { isActive: false } });
    expect((await createQuestionAction({ ...q(1), courseId: course.id })).success).toBe(false);
    // a non-owner who forged ADMIN in the JWT but is a student in the DB
    const forger = await createUser("STUDENT"); actAs({ id: forger.id, role: "ADMIN" });
    const c2 = await bareCourse(owner.id);
    expect((await createQuestionAction({ ...q(1), courseId: c2.id })).success).toBe(false);
    expect(await db.question.count()).toBe(0);
  });

  it("12 concurrent additions: no failures, UNIQUE consecutive order numbers", async () => {
    const owner = await createUser("CREATOR"); const course = await bareCourse(owner.id);   // no quiz yet → also races quiz creation
    actAs({ id: owner.id, role: "CREATOR" });
    const res = await Promise.all(Array.from({ length: 12 }, (_, i) => createQuestionAction({ ...q(i), courseId: course.id })));
    expect(res.filter((r) => r.success)).toHaveLength(12);
    expect(await db.quiz.count({ where: { courseId: course.id } })).toBe(1);
    const orders = (await db.question.findMany({ where: { quiz: { courseId: course.id } }, orderBy: { order: "asc" } })).map((x) => x.order);
    expect(orders).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("rejects oversized or malformed input (payload bounds)", async () => {
    const owner = await createUser("CREATOR"); const course = await bareCourse(owner.id);
    actAs({ id: owner.id, role: "CREATOR" });
    const bad = [
      q(1, { text: "x".repeat(200_000) }), q(1, { text: "y".repeat(501) }), q(1, { explanation: "z".repeat(501) }),
      q(1, { options: ["right", "w1", "w2", "w".repeat(151)] }), q(1, { options: ["right", "w1", "w2"] }),
    ];
    for (const b of bad) expect((await createQuestionAction({ ...b, courseId: course.id } as never)).success).toBe(false);
    expect(await db.question.count()).toBe(0);
  });

  it("rate-limits authoring (60/hour per user)", async () => {
    const owner = await createUser("CREATOR"); const course = await bareCourse(owner.id);
    actAs({ id: owner.id, role: "CREATOR" });
    const out = [];
    for (let i = 0; i < 62; i++) out.push((await createQuestionAction({ ...q(i), courseId: course.id })).success);
    expect(out.filter(Boolean)).toHaveLength(60);
  }, 60_000);
});

describe("AI quiz generation (generateQuizDraftAction) — guards run BEFORE any paid AI call", () => {
  it("non-owner → FORBIDDEN; suspended owner → UNAUTHORIZED; forged JWT admin → FORBIDDEN", async () => {
    const owner = await createUser("CREATOR"); const other = await createUser("CREATOR"); const course = await bareCourse(owner.id);
    actAs({ id: other.id, role: "CREATOR" });
    expect(await generateQuizDraftAction({ courseId: course.id, questionCount: 5, difficulty: "INTERMEDIATE" } as never)).toMatchObject({ success: false, error: "FORBIDDEN" });
    const forger = await createUser("STUDENT"); actAs({ id: forger.id, role: "ADMIN" });
    expect(await generateQuizDraftAction({ courseId: course.id, questionCount: 5, difficulty: "INTERMEDIATE" } as never)).toMatchObject({ success: false, error: "FORBIDDEN" });
    await db.user.update({ where: { id: owner.id }, data: { isActive: false } });
    actAs({ id: owner.id, role: "CREATOR" });
    expect(await generateQuizDraftAction({ courseId: course.id, questionCount: 5, difficulty: "INTERMEDIATE" } as never)).toMatchObject({ success: false, error: "UNAUTHORIZED" });
  });

  it("is rate-limited (10/hour): the 11th call is refused before touching the AI", async () => {
    const owner = await createUser("CREATOR"); const course = await bareCourse(owner.id);
    actAs({ id: owner.id, role: "CREATOR" });
    const errs: string[] = [];
    for (let i = 0; i < 12; i++) { const r = await generateQuizDraftAction({ courseId: course.id, questionCount: 5, difficulty: "INTERMEDIATE" } as never); errs.push(r.success ? "ok" : r.error); }
    expect(errs.slice(0, 10).every((e) => e === "GEMINI_NOT_CONFIGURED")).toBe(true); // reached the AI step (no key in tests)
    expect(errs.slice(10)).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
  });
});
