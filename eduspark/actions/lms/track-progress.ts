"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { EnrollmentStatus } from "@prisma/client";
import { awardXP } from "@/lib/gamification/award";

// ─── Schema & Types ───────────────────────────────────────────────────────────

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

// ─── Action ───────────────────────────────────────────────────────────────────

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

    // Validate enrollment + lesson in one parallel trip
    const [enrollment, lesson] = await Promise.all([
      db.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, isPassed: true },
      }),
      db.lesson.findFirst({
        where: {
          id: lessonId,
          section: { courseId },
        },
        select: { id: true },
      }),
    ]);

    if (!enrollment) return { success: false, error: "NOT_ENROLLED" };
    if (!lesson) return { success: false, error: "LESSON_NOT_FOUND" };

    // Short-circuit: course already completed — idempotent guard
    if (enrollment.isPassed) {
      const [completedLessons, totalLessons] = await Promise.all([
        db.lessonProgress.count({
          where: { enrollmentId: enrollment.id, completed: true },
        }),
        db.lesson.count({ where: { section: { courseId } } }),
      ]);

      return {
        success: true,
        progress: 100,
        isPassed: true,
        completedLessons,
        totalLessons,
      };
    }

    const alreadyDone = await db.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      select: { completed: true },
    });

    // Upsert lesson progress — fully idempotent
    await db.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        completed: true,
        watchedAt: new Date(),
      },
      update: {
        completed: true,
        watchedAt: new Date(),
      },
    });

    // XP only the FIRST time a lesson is completed (prevents XP farming).
    if (!alreadyDone?.completed) {
      void awardXP(userId, "LESSON_COMPLETED").catch((err) =>
        console.error("[GAMIFICATION] track-progress lesson XP:", err)
      );
    }

    // Recalculate progress with fresh counts
    const [completedLessons, totalLessons] = await Promise.all([
      db.lessonProgress.count({
        where: { enrollmentId: enrollment.id, completed: true },
      }),
      db.lesson.count({ where: { section: { courseId } } }),
    ]);

    const rawRatio = totalLessons > 0 ? completedLessons / totalLessons : 0;
    const progress = Math.min(100, Math.round(rawRatio * 100));
    const isPassed = progress >= 100;

    // Persist progress — promote to COMPLETED if finished.
    // Compare-and-set: only ONE concurrent request can flip isPassed.
    let justCompleted = false;
    if (isPassed) {
      const flipped = await db.enrollment.updateMany({
        where: { id: enrollment.id, isPassed: false },
        data: {
          progress,
          status: EnrollmentStatus.COMPLETED,
          isPassed: true,
          completedAt: new Date(),
        },
      });
      justCompleted = flipped.count === 1;
    } else {
      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { progress },
      });
    }

    // ── Award course completion XP (only on the transition) ────────
    if (justCompleted) {
      void awardXP(userId, "COURSE_COMPLETED").catch((err) =>
        console.error("[GAMIFICATION] course completion XP:", err)
      );
    }

    revalidatePath(`/dashboard/student/courses/${courseId}`);

    return { success: true, progress, isPassed, completedLessons, totalLessons };
  } catch (error) {
    console.error("[TRACK_PROGRESS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}