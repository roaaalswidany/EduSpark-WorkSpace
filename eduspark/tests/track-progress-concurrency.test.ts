import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { trackProgressAction } from "@/actions/lms/track-progress";
import {
  createUser,
  createCourseWithQuiz,
  enroll,
  resetDatabase,
} from "./helpers/factories";
import { XP_REWARDS } from "@/lib/gamification/xp-rules";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
}));

function actAs(user: { id: string; role: string }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function settle(ms = 400) {
  await new Promise((r) => setTimeout(r, ms));
}

describe("track-progress — concurrency safety", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("8 concurrent completions of the SAME lesson award LESSON_COMPLETED XP exactly once", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({
      creatorId: creator.id,
      lessons: 2,
    });
    actAs({ id: student.id, role: "STUDENT" });

    const enrollment = await enroll(student.id, course.id);
    const [l1] = course.sections[0].lessons.sort(
      (a, b) => a.order - b.order
    );

    const results = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        trackProgressAction({ courseId: course.id, lessonId: l1.id })
      )
    );

    expect(results.every((r) => r.success)).toBe(true);

    await settle();
    const xp =
      (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ??
      0;
    expect(xp).toBe(XP_REWARDS.LESSON_COMPLETED);

    const updated = await db.enrollment.findUnique({
      where: { id: enrollment.id },
    });
    expect(updated?.progress).toBe(50);
    expect(updated?.isPassed).toBe(false);

    const lp = await db.lessonProgress.count({
      where: {
        enrollmentId: enrollment.id,
        lessonId: l1.id,
        completed: true,
      },
    });
    expect(lp).toBe(1);
  });

  it("concurrent completions across all lessons yield 100% progress and one COURSE_COMPLETED", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({
      creatorId: creator.id,
      lessons: 4,
    });
    actAs({ id: student.id, role: "STUDENT" });

    const enrollment = await enroll(student.id, course.id);
    const lessons = course.sections[0].lessons.sort(
      (a, b) => a.order - b.order
    );

    // 2 concurrent calls per lesson = 8 total
   const calls: Promise<{ success: boolean }>[] = [];
    for (const lesson of lessons) {
      for (let i = 0; i < 2; i++) {
        calls.push(
          trackProgressAction({ courseId: course.id, lessonId: lesson.id })
        );
      }
    }
  const results = (await Promise.all(calls)) as Array<{ success: boolean }>;
    expect(results.every((r) => r.success)).toBe(true);

    await settle(600);
    const xp =
      (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ??
      0;
    expect(xp).toBe(
      4 * XP_REWARDS.LESSON_COMPLETED + XP_REWARDS.COURSE_COMPLETED
    );

    const updated = await db.enrollment.findUnique({
      where: { id: enrollment.id },
    });
    expect(updated?.progress).toBe(100);
    expect(updated?.isPassed).toBe(true);
  });

  it("repeated calls after course completion award nothing new", async () => {
    const creator = await createUser("CREATOR");
    const student = await createUser();
    const course = await createCourseWithQuiz({
      creatorId: creator.id,
      lessons: 1,
    });
    actAs({ id: student.id, role: "STUDENT" });

    await enroll(student.id, course.id);
    const [l1] = course.sections[0].lessons;

    await trackProgressAction({ courseId: course.id, lessonId: l1.id });
    await settle();
    const xpAfterFirst =
      (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ??
      0;
    expect(xpAfterFirst).toBe(
      XP_REWARDS.LESSON_COMPLETED + XP_REWARDS.COURSE_COMPLETED
    );

    // 5 more calls (sequential + concurrent mix)
    for (let i = 0; i < 5; i++) {
      await trackProgressAction({ courseId: course.id, lessonId: l1.id });
    }
    await settle();

    const xpAfter =
      (await db.userStats.findUnique({ where: { userId: student.id } }))?.xp ??
      0;
    expect(xpAfter).toBe(xpAfterFirst);
  });
});