"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role, CourseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  courseId: z.string().cuid(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export async function updateCourseStatusAction(
  raw: z.infer<typeof Schema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const user = await getFreshUser(session.user.id);
    if (!user?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (user.role !== Role.CREATOR && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    const { courseId, status } = Schema.parse(raw);

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true, slug: true },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };
    if (course.creatorId !== session.user.id && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }

    // Guard: can't publish an empty course
    if (status === "PUBLISHED") {
      const lessonCount = await db.lesson.count({
        where: { section: { courseId } },
      });
      if (lessonCount === 0) {
        return { success: false, error: "CANNOT_PUBLISH_EMPTY_COURSE" };
      }
    }

    await db.course.update({
      where: { id: courseId },
      data: { status: status as CourseStatus },
    });

    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    revalidatePath(`/dashboard/creator/courses`);
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath(`/courses`);
    return { success: true };
  } catch (e) {
    console.error("[UPDATE_COURSE_STATUS]", e);
    return { success: false, error: "SERVER_ERROR" };
  }
}