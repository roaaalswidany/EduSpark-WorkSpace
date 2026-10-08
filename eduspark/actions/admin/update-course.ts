"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";

const UpdateCourseSchema = z.object({
  courseId: z.string().cuid(),
  action: z.enum(["CHANGE_STATUS"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export type UpdateCourseResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

export async function updateCourseAction(
  input: z.infer<typeof UpdateCourseSchema>
): Promise<UpdateCourseResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (session.user.role !== "ADMIN") {
      return { success: false, error: "FORBIDDEN" };
    }

    const parsed = UpdateCourseSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { courseId, action, status } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };

    if (action === "CHANGE_STATUS" && status) {
      await db.course.update({
        where: { id: courseId },
        data: { status: status as CourseStatus },
      });
    }

    // ── Invalidate Redis cache so next visit fetches fresh data ──
    await cacheInvalidatePattern(CacheKeys.patterns.allCourses);

    revalidatePath("/dashboard/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/dashboard/student/courses");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_COURSE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}