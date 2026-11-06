"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getFreshUser } from "@/lib/security/fresh-user";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { COURSE_REVIEW_MIN_PROGRESS } from "@/lib/lms/review-policy";

const Schema = z.object({
  courseId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateCourseReviewResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "NOT_ENROLLED"
        | "NOT_ENOUGH_PROGRESS"
        | "COURSE_NOT_AVAILABLE"
        | "OWN_COURSE"
        | "ALREADY_REVIEWED"
        | "RATE_LIMITED"
        | "SERVER_ERROR";
    };

export async function createCourseReviewAction(
  input: z.infer<typeof Schema>
): Promise<CreateCourseReviewResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const userId = session.user.id;

    // A suspended account must not be able to rate (the JWT can outlive the suspension).
    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "FORBIDDEN" };

    const retryAfter = await limitByUser(RateLimits.COURSE_REVIEW, userId);
    if (retryAfter !== null) return { success: false, error: "RATE_LIMITED" };

    const parsed = Schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { courseId, rating, comment } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { slug: true, status: true, creatorId: true },
    });
    if (!course || course.status !== "PUBLISHED") {
      return { success: false, error: "COURSE_NOT_AVAILABLE" };
    }
    if (course.creatorId === userId) return { success: false, error: "OWN_COURSE" };

    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { progress: true },
    });
    if (!enrollment) return { success: false, error: "NOT_ENROLLED" };
    // Enrolment is free and instant: require real progress before a rating counts.
    if (enrollment.progress < COURSE_REVIEW_MIN_PROGRESS) {
      return { success: false, error: "NOT_ENOUGH_PROGRESS" };
    }

    // One transaction: lock the course row, insert, recompute the aggregate.
    // The lock serialises concurrent reviews of the same course, so the stored average/count
    // always match the rows (without it two simultaneous reviews can leave a stale average).
    try {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM courses WHERE id = ${courseId} FOR UPDATE`;

        await tx.review.create({
          data: {
            userId,
            courseId,
            rating,
            comment: comment && comment.length > 0 ? comment : null,
          },
        });

        const agg = await tx.review.aggregate({
          where: { courseId },
          _avg: { rating: true },
          _count: true,
        });
        await tx.course.update({
          where: { id: courseId },
          data: { totalRating: agg._avg.rating ?? 0, ratingCount: agg._count },
        });
      });
    } catch (err) {
      // @@unique([userId, courseId]) — a concurrent duplicate is a normal outcome, not a server error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { success: false, error: "ALREADY_REVIEWED" };
      }
      throw err;
    }

    revalidatePath(`/courses/${course.slug}`);
    return { success: true };
  } catch (err) {
    console.error("[CREATE_COURSE_REVIEW]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}
