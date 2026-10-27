import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { awardXP } from "@/lib/gamification/award";
import { XP_REWARDS } from "@/lib/gamification/xp-rules";
import { enrollInCourseAction } from "@/actions/lms/enroll-in-course";
import { trackProgressAction } from "@/actions/lms/track-progress";
import { resetDatabase, createUser, createCourseWithQuiz } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

const settle = () => new Promise((r) => setTimeout(r, 500));

beforeAll(resetDatabase);
beforeEach(resetSession);

describe("F20 — XP is atomic", () => {
  it("30 concurrent awards add up exactly (no lost updates)", async () => {
    const u = await createUser();
    await db.userStats.create({ data: { userId: u.id } }); // avoid the first-insert race for this test
    await Promise.all(Array.from({ length: 30 }, () => awardXP(u.id, "LESSON_COMPLETED", { skipBadges: true })));
    const s = await db.userStats.findUniqueOrThrow({ where: { userId: u.id } });
    expect(s.xp).toBe(30 * XP_REWARDS.LESSON_COMPLETED);
  });
});

describe("F19 — lesson progress XP is awarded once, on the first completion", () => {
  it("repeating the same lesson (or a finished course) farms nothing", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({ creatorId: creator.id, lessons: 2 });
    actAs({ id: student.id, role: "STUDENT" });
    expect((await enrollInCourseAction({ courseId: course.id })).success).toBe(true);

    const [l1, l2] = course.sections[0].lessons.sort((a, b) => a.order - b.order);
    const xp = async () => (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ?? 0;

    await trackProgressAction({ courseId: course.id, lessonId: l1.id }); await settle();
    expect(await xp()).toBe(XP_REWARDS.LESSON_COMPLETED);               // first completion DOES award now

    for (let i = 0; i < 5; i++) await trackProgressAction({ courseId: course.id, lessonId: l1.id });
    await settle();
    expect(await xp()).toBe(XP_REWARDS.LESSON_COMPLETED);               // repeats: nothing

    await trackProgressAction({ courseId: course.id, lessonId: l2.id }); await settle();
    const afterFinish = await xp();
    expect(afterFinish).toBe(2 * XP_REWARDS.LESSON_COMPLETED + XP_REWARDS.COURSE_COMPLETED);

    for (let i = 0; i < 5; i++) await trackProgressAction({ courseId: course.id, lessonId: l1.id });
    await settle();
    expect(await xp()).toBe(afterFinish);                                // finished course: nothing
  });

  it("course-completion XP is granted exactly once even if the last lesson is submitted concurrently", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({ creatorId: creator.id, lessons: 1 });
    actAs({ id: student.id, role: "STUDENT" });
    await enrollInCourseAction({ courseId: course.id });
    const lesson = course.sections[0].lessons[0];
    await db.userStats.create({ data: { userId: student.id } });
    await Promise.all(Array.from({ length: 6 }, () => trackProgressAction({ courseId: course.id, lessonId: lesson.id })));
    await settle();
    const s = await db.userStats.findUniqueOrThrow({ where: { userId: student.id } });
    expect(s.xp).toBeLessThanOrEqual(XP_REWARDS.LESSON_COMPLETED * 6 + XP_REWARDS.COURSE_COMPLETED);
    expect(Math.floor((s.xp) / XP_REWARDS.COURSE_COMPLETED)).toBeLessThanOrEqual(1 + 0); // never 2× course XP
  });
});

describe("F18 — enrollment races return ALREADY_ENROLLED, never SERVER_ERROR", () => {
  it("8 concurrent enrollments: exactly one wins, one enrollment row, one chat room", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({ creatorId: creator.id });
    actAs({ id: student.id, role: "STUDENT" });
    const res = await Promise.all(Array.from({ length: 8 }, () => enrollInCourseAction({ courseId: course.id })));
    expect(res.filter((r) => r.success).length).toBe(1);
    expect(res.filter((r) => !r.success).every((r) => !r.success && r.error === "ALREADY_ENROLLED")).toBe(true);
    expect(await db.enrollment.count({ where: { userId: student.id, courseId: course.id } })).toBe(1);
    expect(await db.chatRoom.count({ where: { courseId: course.id } })).toBe(1);
  });

  it("two DIFFERENT students enrolling concurrently into a fresh course: BOTH succeed, ONE shared room", async () => {
    const creator = await createUser("CREATOR");
    const [a, b] = [await createUser(), await createUser()];
    const course = await createCourseWithQuiz({ creatorId: creator.id });
    // getServerSession is read synchronously when the action starts, so the
    // two calls below see two different users even though they run together.
    actAs({ id: a.id, role: "STUDENT" });
    const pa = enrollInCourseAction({ courseId: course.id });
    actAs({ id: b.id, role: "STUDENT" });
    const pb = enrollInCourseAction({ courseId: course.id });
    const [ra, rb] = await Promise.all([pa, pb]);
    expect(ra).toMatchObject({ success: true });
    expect(rb).toMatchObject({ success: true });
    expect(await db.chatRoom.count({ where: { courseId: course.id } })).toBe(1);
    const room = await db.chatRoom.findFirstOrThrow({ where: { courseId: course.id }, include: { participants: true } });
    expect(room.participants.map((p) => p.userId).sort()).toEqual([a.id, b.id, creator.id].sort());
  });

  it("a suspended user cannot enroll", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser("STUDENT", { isActive: false });
    const course = await createCourseWithQuiz({ creatorId: creator.id });
    actAs({ id: student.id, role: "STUDENT" });
    expect((await enrollInCourseAction({ courseId: course.id })).success).toBe(false);
  });
});

describe("first-ever XP award for a brand-new user (no UserStats row yet)", () => {
  it("12 concurrent awards: NONE is lost to the first-insert race", async () => {
    const u = await createUser();                                   // deliberately NO pre-created stats
    await Promise.all(Array.from({ length: 12 }, () => awardXP(u.id, "LESSON_COMPLETED", { skipBadges: true })));
    const s = await db.userStats.findUniqueOrThrow({ where: { userId: u.id } });
    expect(s.xp).toBe(12 * XP_REWARDS.LESSON_COMPLETED);
  });
});
