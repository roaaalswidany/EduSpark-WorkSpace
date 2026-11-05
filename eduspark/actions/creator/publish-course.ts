"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog, AuditActions } from "@/lib/security/audit";
import { checkCourseReadiness } from "@/lib/lms/course-review";

/**
 * Course lifecycle (see lib/lms/course-review.ts):
 *   DRAFT          → PENDING_REVIEW   owner submits for admin review
 *   PENDING_REVIEW → DRAFT            owner withdraws
 *   PUBLISHED      → DRAFT            owner unpublishes (to edit the quiz, then resubmit)
 *   * → PUBLISHED                     ADMIN ONLY (creators get REVIEW_REQUIRED)
 */
const Schema = z.object({
  courseId: z.string().cuid(),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]),
});

export type UpdateCourseStatusResult = { success: boolean; error?: string };

export async function updateCourseStatusAction(
  raw: z.infer<typeof Schema>
): Promise<UpdateCourseStatusResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const user = await getFreshUser(session.user.id);
    if (!user?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (user.role !== Role.CREATOR && user.role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN" };
    }
    const isAdmin = user.role === Role.ADMIN;

    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { courseId, status } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true, slug: true, title: true, status: true },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };
    if (course.creatorId !== session.user.id && !isAdmin) {
      return { success: false, error: "FORBIDDEN" };
    }

    const now = new Date();

    if (status === "PUBLISHED") {
      // Only an administrator can publish. Creators must submit for review.
      if (!isAdmin) return { success: false, error: "REVIEW_REQUIRED" };

      const notReady = await checkCourseReadiness(courseId);
      if (notReady) return { success: false, error: notReady };

      const res = await db.course.updateMany({
        where: { id: courseId, status: { in: ["DRAFT", "PENDING_REVIEW"] } },
        data: { status: "PUBLISHED", reviewedAt: now, reviewedById: session.user.id },
      });
      if (res.count !== 1) return { success: false, error: "INVALID_STATE" };
    } else if (status === "PENDING_REVIEW") {
      const notReady = await checkCourseReadiness(courseId);
      if (notReady) return { success: false, error: notReady };

      // Compare-and-set: only a DRAFT can be submitted (no double submissions).
      const res = await db.course.updateMany({
        where: { id: courseId, status: "DRAFT" },
        data: { status: "PENDING_REVIEW", submittedAt: now, reviewNote: null },
      });
      if (res.count !== 1) return { success: false, error: "INVALID_STATE" };

      // Tell the admins there is something to review (best-effort).
      try {
        const admins = await db.user.findMany({
          where: { role: Role.ADMIN, isActive: true, id: { not: session.user.id } },
          select: { id: true },
          take: 50,
        });
        if (admins.length > 0) {
          await db.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Course awaiting review",
              body: `"${course.title}" was submitted for review.`,
              link: "/dashboard/admin/courses?status=PENDING_REVIEW",
            })),
          });
        }
      } catch (err) {
        console.error("[COURSE_SUBMIT_NOTIFY]", err);
      }

      void auditLog({
        action: AuditActions.COURSE_SUBMITTED_FOR_REVIEW,
        userId: session.user.id,
        targetType: "Course",
        targetId: courseId,
        metadata: { title: course.title },
      });
    } else {
      // DRAFT: withdraw a pending submission, or unpublish.
      const res = await db.course.updateMany({
        where: { id: courseId, status: { in: ["PENDING_REVIEW", "PUBLISHED"] } },
        data: { status: "DRAFT" },
      });
      if (res.count !== 1) return { success: false, error: "INVALID_STATE" };

      void auditLog({
        action: AuditActions.COURSE_WITHDRAWN,
        userId: session.user.id,
        targetType: "Course",
        targetId: courseId,
        metadata: { title: course.title, from: course.status },
      });
    }

    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    revalidatePath(`/dashboard/creator/courses`);
    revalidatePath(`/dashboard/admin/courses`);
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath(`/courses`);
    return { success: true };
  } catch (e) {
    console.error("[UPDATE_COURSE_STATUS]", e);
    return { success: false, error: "SERVER_ERROR" };
  }
}
