"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { EnrollmentStatus } from "@prisma/client";
import { awardXP } from "@/lib/gamification/award";

const TrackProgressSchema = z.object({
  courseId: z.string().cuid("Invalid course ID."),
  lessonId: z.string().cuid("Invalid lesson ID."),
});

export type TrackProgressInput = z.infer<typeof TrackProgressSchema>;

export type TrackProgressResult =
  | {
      success: true;
      progress: number;
      isPassed: boolean;
      completedLessons: number;
      totalLessons: number;
    }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "NOT_ENROLLED"
        | "LESSON_NOT_FOUND"
        | "SERVER_ERROR";
    };

export async function trackProgressAction(
  rawInput: TrackProgressInput
): Promise<TrackProgressResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = TrackProgressSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { courseId, lessonId } = parsed.data;
    const userId = session.user.id;

    // Fast structural checks (outside transaction — read-only).
    const [enrollmentMeta, lessonMeta] = await Promise.all([
      db.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      }),
      db.lesson.findFirst({
        where: { id: lessonId, section: { courseId } },
        select: { id: true },
      }),
    ]);

    if (!enrollmentMeta) return { success: false, error: "NOT_ENROLLED" };
    if (!lessonMeta) return { success: false, error: "LESSON_NOT_FOUND" };

    const enrollmentId = enrollmentMeta.id;

    // ── Atomic transition ────────────────────────────────────────────────
    // All reads and writes happen inside a transaction that holds a row
    // lock on the enrollment. Concurrent calls for the same enrollment
    // queue at FOR UPDATE, so:
    //   1. "alreadyDone" cannot be stale → LESSON_COMPLETED XP is awarded
    //      exactly once, even under 8-way concurrency.
    //   2. progress recount + write cannot regress (no stale last-writer).
    const txResult = await db.$transaction(async (tx) => {
      // Serialize per-enrollment writes.
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id = ${enrollmentId} FOR UPDATE`;

      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { isPassed: true },
      });
      if (!enrollment) throw new Error("NOT_ENROLLED");

      // Idempotent short-circuit (re-checked inside the lock).
      if (enrollment.isPassed) {
        const [completedLessons, totalLessons] = await Promise.all([
          tx.lessonProgress.count({
            where: { enrollmentId, completed: true },
          }),
          tx.lesson.count({ where: { section: { courseId } } }),
        ]);
        return {
          lessonWasNewlyCompleted: false,
          courseWasJustCompleted: false,
          progress: 100,
          isPassed: true,
          completedLessons,
          totalLessons,
        };
      }

      // Read inside the lock: no stale read.
      const existingProgress = await tx.lessonProgress.findUnique({
        where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
        select: { completed: true },
      });
      const alreadyCompleted = existingProgress?.completed === true;

      // Upsert lesson progress (idempotent at the row level).
      await tx.lessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
        create: {
          enrollmentId,
          lessonId,
          completed: true,
          watchedAt: new Date(),
        },
        update: { completed: true, watchedAt: new Date() },
      });

      // Recount inside the lock: no stale count.
      const [completedLessons, totalLessons] = await Promise.all([
        tx.lessonProgress.count({ where: { enrollmentId, completed: true } }),
        tx.lesson.count({ where: { section: { courseId } } }),
      ]);

      const rawRatio = totalLessons > 0 ? completedLessons / totalLessons : 0;
      const progress = Math.min(100, Math.round(rawRatio * 100));
      const isPassed = progress >= 100;

      let courseWasJustCompleted = false;
      if (isPassed) {
        // Compare-and-set: only ONE concurrent caller flips isPassed.
        const flipped = await tx.enrollment.updateMany({
          where: { id: enrollmentId, isPassed: false },
          data: {
            progress,
            status: EnrollmentStatus.COMPLETED,
            isPassed: true,
            completedAt: new Date(),
          },
        });
        courseWasJustCompleted = flipped.count === 1;
      } else {
        // Safe to overwrite: we're inside the lock, so no concurrent write
        // can regress progress between our count and our write.
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { progress },
        });
      }

      return {
        lessonWasNewlyCompleted: !alreadyCompleted,
        courseWasJustCompleted,
        progress,
        isPassed,
        completedLessons,
        totalLessons,
      };
    });

    // ── XP awards — exactly-once, fire-and-forget ───────────────────────
    // The flags below are set inside the transaction, so at most one
    // concurrent caller sees `true` for each flag. We keep `void` (not
    // `await`) to preserve the original design: XP is secondary, and a
    // failed award must not fail the progress mutation.
    if (txResult.lessonWasNewlyCompleted) {
      void awardXP(userId, "LESSON_COMPLETED").catch((err) =>
        console.error("[GAMIFICATION] track-progress lesson XP:", err)
      );
    }
    if (txResult.courseWasJustCompleted) {
      void awardXP(userId, "COURSE_COMPLETED").catch((err) =>
        console.error("[GAMIFICATION] course completion XP:", err)
      );
    }

    revalidatePath(`/dashboard/student/courses/${courseId}`);

    return {
      success: true,
      progress: txResult.progress,
      isPassed: txResult.isPassed,
      completedLessons: txResult.completedLessons,
      totalLessons: txResult.totalLessons,
    };
  } catch (error) {
    console.error("[TRACK_PROGRESS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}