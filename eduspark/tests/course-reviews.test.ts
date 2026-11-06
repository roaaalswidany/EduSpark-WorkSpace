import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createCourseReviewAction } from "@/actions/reviews/create-course-review";
import { COURSE_REVIEW_MIN_PROGRESS } from "@/lib/lms/review-policy";
import { resetDatabase, createUser, createCourseWithQuiz, enroll } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

let creator: Awaited<ReturnType<typeof createUser>>;
let courseId: string;

beforeEach(async () => {
  resetSession();
  await resetDatabase();
  creator = await createUser("CREATOR");
  courseId = (await createCourseWithQuiz({ creatorId: creator.id })).id;
});

/** A student enrolled in the course with the given progress (percent). */
async function student(progress = 100, extra: Record<string, unknown> = {}) {
  const u = await createUser("STUDENT", extra);
  await enroll(u.id, courseId);
  await db.enrollment.update({ where: { userId_courseId: { userId: u.id, courseId } }, data: { progress } });
  return u;
}
const as = (u: { id: string }) => actAs({ id: u.id, role: "STUDENT" });
const review = (rating = 5, comment?: string) => createCourseReviewAction({ courseId, rating, comment });
const stats = async () => db.course.findUniqueOrThrow({ where: { id: courseId }, select: { totalRating: true, ratingCount: true } });

describe("course reviews — who may rate", () => {
  it("refuses: anonymous, suspended, not enrolled, too little progress, own course, unpublished course", async () => {
    actAs(null);
    expect(await review()).toMatchObject({ success: false, error: "UNAUTHORIZED" });

    const suspended = await student(100, { isActive: false });
    as(suspended);
    expect(await review()).toMatchObject({ success: false, error: "FORBIDDEN" });

    const outsider = await createUser("STUDENT"); as(outsider);
    expect(await review()).toMatchObject({ success: false, error: "NOT_ENROLLED" });

    const early = await student(COURSE_REVIEW_MIN_PROGRESS - 1); as(early);
    expect(await review()).toMatchObject({ success: false, error: "NOT_ENOUGH_PROGRESS" });

    await enroll(creator.id, courseId);
    await db.enrollment.update({ where: { userId_courseId: { userId: creator.id, courseId } }, data: { progress: 100 } });
    actAs({ id: creator.id, role: "CREATOR" });
    expect(await review()).toMatchObject({ success: false, error: "OWN_COURSE" });

    const ok = await student(100); as(ok);
    await db.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
    expect(await review()).toMatchObject({ success: false, error: "COURSE_NOT_AVAILABLE" });

    expect((await stats()).ratingCount).toBe(0);
  });

  it("validates the rating (0, 6, 2.5) and the comment length", async () => {
    const s = await student(100); as(s);
    for (const rating of [0, 6, 2.5]) expect(await review(rating)).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await review(5, "x".repeat(1001))).toMatchObject({ success: false, error: "INVALID_INPUT" });
  });

  it("a student at exactly the minimum progress may review", async () => {
    const s = await student(COURSE_REVIEW_MIN_PROGRESS); as(s);
    expect((await review(4)).success).toBe(true);
  });
});

describe("course reviews — correctness under concurrency", () => {
  it("stores the review, updates the course aggregate, and refuses a second review", async () => {
    const s = await student(100); as(s);
    expect((await review(5, "  Great course  ")).success).toBe(true);
    expect(await stats()).toMatchObject({ totalRating: 5, ratingCount: 1 });
    expect((await db.review.findFirstOrThrow({ where: { userId: s.id } })).comment).toBe("Great course");
    expect(await review(1)).toMatchObject({ success: false, error: "ALREADY_REVIEWED" });
    expect(await stats()).toMatchObject({ totalRating: 5, ratingCount: 1 });
  });

  it("6 concurrent submissions by the SAME student: exactly one wins, the rest are ALREADY_REVIEWED (never SERVER_ERROR)", async () => {
    const s = await student(100); as(s);
    const res = await Promise.all(Array.from({ length: 6 }, () => review(5)));
    expect(res.filter((r) => r.success)).toHaveLength(1);
    expect(res.filter((r) => !r.success).every((r) => !r.success && r.error === "ALREADY_REVIEWED")).toBe(true);
    expect(await db.review.count({ where: { courseId } })).toBe(1);
  });

  it("8 different students reviewing at the same moment: count and average match the rows exactly", async () => {
    const ratings = [5, 4, 3, 5, 2, 4, 1, 5];
    const students = await Promise.all(ratings.map(() => student(100)));
    const res = await Promise.all(
      students.map((u, i) => {
        as(u); // the mocked session is shared; the action reads it synchronously before awaiting
        return createCourseReviewAction({ courseId, rating: ratings[i] });
      })
    );
    const won = res.filter((r) => r.success).length;
    const rows = await db.review.findMany({ where: { courseId } });
    expect(rows).toHaveLength(won);
    const avg = rows.reduce((a, r) => a + r.rating, 0) / rows.length;
    const st = await stats();
    expect(st.ratingCount).toBe(rows.length);
    expect(st.totalRating).toBeCloseTo(avg, 5);
  });
});

describe("course reviews — abuse limits", () => {
  it("is rate-limited (10/hour per user): the 11th call is refused", async () => {
    const s = await student(100); as(s);
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await review(5));
    expect(results[0].success).toBe(true);
    expect(results[10]).toMatchObject({ success: false, error: "RATE_LIMITED" });
  });
});
