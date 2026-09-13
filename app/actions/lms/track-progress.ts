"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/app/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { EnrollmentStatus } from "@prisma/client";

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

    // Persist progress — promote to COMPLETED if finished
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progress,
        ...(isPassed && {
          status: EnrollmentStatus.COMPLETED,
          isPassed: true,
          completedAt: new Date(),
        }),
      },
    });

    revalidatePath(`/dashboard/student/courses/${courseId}`);

    return { success: true, progress, isPassed, completedLessons, totalLessons };
  } catch (error) {
    console.error("[TRACK_PROGRESS_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}