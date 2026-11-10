import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { updateCourseStatusAction } from "@/actions/creator/publish-course";
import { reviewCourseAction } from "@/actions/admin/review-course";
import { updateCourseAction } from "@/actions/admin/update-course";
import { createQuestionAction } from "@/actions/lms/create-question";
import { createSectionAction } from "@/actions/creator/manage-curriculum";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { resetDatabase, createUser, createCategory, enroll } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";
import { outbox, clearOutbox } from "./helpers/mail";

/** A course in DRAFT with N lessons and a quiz of N questions (factory-style options). */
async function draftCourse(
  creatorId: string,
  opts: { lessons?: number; questions?: number; categoryId?: string } = {}
) {
  const { lessons = 1, questions = 4, categoryId } = opts;
  const slug = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return db.course.create({
    data: {
      title: `Course ${slug}`, slug, description: "d", price: 0, status: "DRAFT", creatorId,
      ...(categoryId ? { categoryId } : {}),
      ...(lessons > 0
        ? { sections: { create: { title: "S1", order: 1, lessons: { create: Array.from({ length: lessons }, (_, i) => ({ title: `L${i + 1}`, order: i + 1 })) } } } }
        : {}),
      ...(questions > 0
        ? {
            quiz: {
              create: {
                title: "Quiz",
                questions: {
                  create: Array.from({ length: questions }, (_, i) => ({
                    text: `Q${i + 1}?`, order: i + 1, correctOption: "A",
                    options: [{ id: "A", text: "a" }, { id: "B", text: "b" }, { id: "C", text: "c" }, { id: "D", text: "d" }],
                  })),
                },
              },
            },
          }
        : {}),
    },
  });
}
const statusOf = async (id: string) => (await db.course.findUniqueOrThrow({ where: { id } })).status;
const asCreator = (u: { id: string }) => actAs({ id: u.id, role: "CREATOR" });
const asAdmin = (u: { id: string }) => actAs({ id: u.id, role: "ADMIN" });
async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 4000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 50));
  }
}
const q = (courseId: string, i = 1) => ({
  courseId, text: `What does concept number ${i} describe?`, options: ["right", "w1", "w2", "w3"],
  correctOption: "right", explanation: "Because it is the right one.",
});

beforeEach(async () => { await resetDatabase(); resetSession(); clearOutbox(); });

describe("course review gate — submission", () => {
  it("a creator can never publish directly; submitting moves DRAFT → PENDING_REVIEW once", async () => {
    const creator = await createUser("CREATOR"); const course = await draftCourse(creator.id);
    asCreator(creator);
    expect(await updateCourseStatusAction({ courseId: course.id, status: "PUBLISHED" })).toMatchObject({ success: false, error: "REVIEW_REQUIRED" });
    expect(await statusOf(course.id)).toBe("DRAFT");

    expect((await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" })).success).toBe(true);
    const after = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after.status).toBe("PENDING_REVIEW");
    expect(after.submittedAt).not.toBeNull();

    // a second submission is refused (compare-and-set)
    expect(await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" })).toMatchObject({ success: false, error: "INVALID_STATE" });
  });

  it("is refused for an empty course and for a quiz below the minimum", async () => {
    const creator = await createUser("CREATOR");
    const empty = await draftCourse(creator.id, { lessons: 0 });
    const short = await draftCourse(creator.id, { questions: 3 });
    asCreator(creator);
    expect(await updateCourseStatusAction({ courseId: empty.id, status: "PENDING_REVIEW" })).toMatchObject({ success: false, error: "CANNOT_PUBLISH_EMPTY_COURSE" });
    expect(await updateCourseStatusAction({ courseId: short.id, status: "PENDING_REVIEW" })).toMatchObject({ success: false, error: "QUIZ_TOO_SHORT" });
    expect(await statusOf(empty.id)).toBe("DRAFT");
    expect(await statusOf(short.id)).toBe("DRAFT");
  });

  it("notifies the other admins; another creator cannot submit someone else's course", async () => {
    const creator = await createUser("CREATOR"); const other = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const course = await draftCourse(creator.id);
    asCreator(other);
    expect(await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    asCreator(creator);
    expect((await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" })).success).toBe(true);
    expect(await db.notification.count({ where: { userId: admin.id, title: { contains: "awaiting review" } } })).toBe(1);
  });

  it("the creator can withdraw a pending submission, but not 'withdraw' a draft", async () => {
    const creator = await createUser("CREATOR"); const course = await draftCourse(creator.id);
    asCreator(creator);
    expect(await updateCourseStatusAction({ courseId: course.id, status: "DRAFT" })).toMatchObject({ success: false, error: "INVALID_STATE" });
    await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    expect((await updateCourseStatusAction({ courseId: course.id, status: "DRAFT" })).success).toBe(true);
    expect(await statusOf(course.id)).toBe("DRAFT");
  });
});

describe("course review gate — the admin decision", () => {
  async function pending() {
    const creator = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const course = await draftCourse(creator.id);
    asCreator(creator);
    await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    return { creator, admin, course };
  }

  it("only a real admin can decide: creator, student and a forged-ADMIN JWT are refused", async () => {
    const { creator, course } = await pending();
    asCreator(creator);
    expect(await reviewCourseAction({ courseId: course.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    const forger = await createUser("STUDENT"); actAs({ id: forger.id, role: "ADMIN" });
    expect(await reviewCourseAction({ courseId: course.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    actAs(null);
    expect(await reviewCourseAction({ courseId: course.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "UNAUTHORIZED" });
    expect(await statusOf(course.id)).toBe("PENDING_REVIEW");
  });

  it("approve publishes, records the reviewer, notifies + emails the creator and writes an audit entry", async () => {
    const { creator, admin, course } = await pending();
    asAdmin(admin); clearOutbox();
    expect(await reviewCourseAction({ courseId: course.id, decision: "APPROVE" })).toMatchObject({ success: true, status: "PUBLISHED" });
    const after = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after).toMatchObject({ status: "PUBLISHED", reviewedById: admin.id });
    expect(after.reviewedAt).not.toBeNull();
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "approved" } } })).toBe(1);
    expect(outbox().some((m) => m.to === creator.email && /published/i.test(m.subject))).toBe(true);
    await until(() => db.auditLog.findFirst({ where: { action: "admin.course.approved", targetId: course.id } }));
  });

  it("reject needs a real note, returns the course to draft, shows the note, and resubmitting clears it", async () => {
    const { creator, admin, course } = await pending();
    asAdmin(admin);
    expect(await reviewCourseAction({ courseId: course.id, decision: "REJECT" })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await reviewCourseAction({ courseId: course.id, decision: "REJECT", note: "too short" })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await statusOf(course.id)).toBe("PENDING_REVIEW");

    const note = "Questions 2 and 3 are ambiguous; please rewrite them.";
    expect(await reviewCourseAction({ courseId: course.id, decision: "REJECT", note })).toMatchObject({ success: true, status: "DRAFT" });
    const after = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(after).toMatchObject({ status: "DRAFT", reviewNote: note });
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "Changes requested" } } })).toBe(1);
    await until(() => db.auditLog.findFirst({ where: { action: "admin.course.rejected", targetId: course.id } }));

    asCreator(creator);
    await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).reviewNote).toBeNull();
  });

  it("only a course that is PENDING_REVIEW can be reviewed", async () => {
    const admin = await createUser("ADMIN"); const creator = await createUser("CREATOR");
    const draft = await draftCourse(creator.id);
    asAdmin(admin);
    expect(await reviewCourseAction({ courseId: draft.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "INVALID_STATE" });
  });

  it("5 concurrent approvals: exactly ONE decision is recorded", async () => {
    const { creator, admin, course } = await pending();
    asAdmin(admin);
    const res = await Promise.all(Array.from({ length: 5 }, () => reviewCourseAction({ courseId: course.id, decision: "APPROVE" })));
    expect(res.filter((r) => r.success)).toHaveLength(1);
    expect(res.filter((r) => !r.success).every((r) => !r.success && r.error === "INVALID_STATE")).toBe(true);
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "approved" } } })).toBe(1);
  });

  it("the generic admin status change cannot publish a course whose quiz is too short", async () => {
    const admin = await createUser("ADMIN"); const creator = await createUser("CREATOR");
    const short = await draftCourse(creator.id, { questions: 3 });
    asAdmin(admin);
    expect(await updateCourseAction({ courseId: short.id, action: "CHANGE_STATUS", status: "PUBLISHED" })).toMatchObject({ success: false, error: "QUIZ_TOO_SHORT" });
    expect(await statusOf(short.id)).toBe("DRAFT");
  });
});

describe("course review gate — what is frozen, and why it matters", () => {
  it("the quiz is frozen once the course leaves DRAFT (creator), but the admin can still edit", async () => {
    const creator = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const course = await draftCourse(creator.id);
    asCreator(creator);
    expect((await createQuestionAction(q(course.id, 5))).success).toBe(true);        // DRAFT: allowed
    await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    expect(await createQuestionAction(q(course.id, 6))).toMatchObject({ success: false, error: "COURSE_LOCKED" });
    asAdmin(admin); await reviewCourseAction({ courseId: course.id, decision: "APPROVE" });
    asCreator(creator);
    expect(await createQuestionAction(q(course.id, 7))).toMatchObject({ success: false, error: "COURSE_LOCKED" });
    asAdmin(admin);
    expect((await createQuestionAction(q(course.id, 8))).success).toBe(true);        // admin: allowed
    asCreator(creator);
    await updateCourseStatusAction({ courseId: course.id, status: "DRAFT" });         // unpublish → editable again
    expect((await createQuestionAction(q(course.id, 9))).success).toBe(true);
  });

  it("the curriculum is frozen while under review and editable again after withdrawing", async () => {
    const creator = await createUser("CREATOR"); const course = await draftCourse(creator.id);
    asCreator(creator);
    await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    expect(await createSectionAction({ courseId: course.id, title: "Sneaky change" })).toMatchObject({ success: false, error: "COURSE_LOCKED" });
    await updateCourseStatusAction({ courseId: course.id, status: "DRAFT" });
    expect((await createSectionAction({ courseId: course.id, title: "Allowed change" })).success).toBe(true);
  });

  it("COLLUSION: a course nobody approved can never issue a certificate or a CREATOR role", async () => {
    const creator = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const course = await draftCourse(creator.id, { categoryId: (await createCategory()).id });
    const accomplice = await createUser("STUDENT"); await enroll(accomplice.id, course.id, { isPassed: true });
    const quiz = await db.quiz.findUniqueOrThrow({ where: { courseId: course.id }, include: { questions: true } });
    const attempt = () => {
      actAs({ id: accomplice.id, role: "STUDENT" });
      return submitQuizAction({ quizId: quiz.id, answers: quiz.questions.map((x) => ({ questionId: x.id, selectedOption: "A" })) });
    };

    expect((await attempt()).success).toBe(false);                       // DRAFT
    asCreator(creator); await updateCourseStatusAction({ courseId: course.id, status: "PENDING_REVIEW" });
    expect((await attempt()).success).toBe(false);                       // PENDING_REVIEW
    expect(await db.certificate.count({ where: { userId: accomplice.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: accomplice.id } })).role).toBe("STUDENT");

    asAdmin(admin); await reviewCourseAction({ courseId: course.id, decision: "APPROVE" });
    const ok = await attempt();                                          // after approval it works
    expect(ok.success && ok.data.passed).toBe(true);
    expect(await db.certificate.count({ where: { userId: accomplice.id } })).toBe(1);
  });
});
