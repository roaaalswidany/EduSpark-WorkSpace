"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  courseId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateCourseReviewResult =
  | { success: true }
  | {
      success: false;
      error: "UNAUTHORIZED" | "INVALID_INPUT" | "NOT_ENROLLED" | "ALREADY_REVIEWED" | "SERVER_ERROR";
    };

export async function createCourseReviewAction(
  input: z.infer<typeof Schema>
): Promise<CreateCourseReviewResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = Schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { courseId, rating, comment } = parsed.data;

    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      select: { id: true },
    });
    if (!enrollment) return { success: false, error: "NOT_ENROLLED" };

    const existing = await db.review.findFirst({
      where: { userId: session.user.id, courseId },
      select: { id: true },
    });
    if (existing) return { success: false, error: "ALREADY_REVIEWED" };

    await db.review.create({
      data: {
        userId: session.user.id,
        courseId,
        rating,
        comment: comment && comment.length > 0 ? comment : null,
      },
    });

    const agg = await db.review.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: true,
    });
    await db.course.update({
      where: { id: courseId },
      data: { totalRating: agg._avg.rating ?? 0, ratingCount: agg._count },
    });

    const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
    if (course) revalidatePath(`/courses/${course.slug}`);

    return { success: true };
  } catch (err) {
    console.error("[CREATE_COURSE_REVIEW]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}