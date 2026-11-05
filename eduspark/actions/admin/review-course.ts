"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";
import { sendMail } from "@/lib/email/mailer";
import { courseApprovedEmail, courseRejectedEmail } from "@/lib/email/templates";
import { auditLog, AuditActions } from "@/lib/security/audit";
import { checkCourseReadiness } from "@/lib/lms/course-review";

const ReviewSchema = z
  .object({
    courseId: z.string().cuid(),
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(1000).optional(),
  })
  // Rejecting without telling the creator why is useless: a note is mandatory.
  .refine((d) => d.decision === "APPROVE" || (d.note?.length ?? 0) >= 10, {
    message: "A rejection needs a note of at least 10 characters.",
    path: ["note"],
  });

export type ReviewCourseResult =
  | { success: true; status: "PUBLISHED" | "DRAFT" }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "INVALID_INPUT"
        | "INVALID_STATE"
        | "CANNOT_PUBLISH_EMPTY_COURSE"
        | "QUIZ_TOO_SHORT"
        | "SERVER_ERROR";
    };

/**
 * Admin decision on a course submitted for review.
 * APPROVE → PUBLISHED (certificates from this course become possible)
 * REJECT  → DRAFT with a mandatory note shown to the creator
 */
export async function reviewCourseAction(
  input: z.infer<typeof ReviewSchema>
): Promise<ReviewCourseResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    // Authoritative role from the DB — a forged/stale JWT role must not be enough.
    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (actor.role !== "ADMIN") return { success: false, error: "FORBIDDEN" };

    const parsed = ReviewSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { courseId, decision, note } = parsed.data;

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        creatorId: true,
        creator: { select: { email: true, name: true } },
      },
    });
    if (!course) return { success: false, error: "NOT_FOUND" };
    if (course.status !== "PENDING_REVIEW") {
      return { success: false, error: "INVALID_STATE" };
    }

    if (decision === "APPROVE") {
      const notReady = await checkCourseReadiness(courseId);
      if (notReady) return { success: false, error: notReady };
    }

    const approve = decision === "APPROVE";
    const now = new Date();
    const cleanNote = note && note.length > 0 ? note : null;

    // Compare-and-set + notification in ONE transaction:
    // two admins clicking at once → exactly one decision is recorded.
    const applied = await db.$transaction(async (tx) => {
      const res = await tx.course.updateMany({
        where: { id: courseId, status: "PENDING_REVIEW" },
        data: {
          status: approve ? "PUBLISHED" : "DRAFT",
          reviewedAt: now,
          reviewedById: session.user.id,
          reviewNote: cleanNote,
        },
      });
      if (res.count !== 1) return false;

      await tx.notification.create({
        data: {
          userId: course.creatorId,
          title: approve ? "Course approved 🎉" : "Changes requested",
          body: approve
            ? `"${course.title}" is now published.`
            : `"${course.title}" needs changes: ${cleanNote}`,
          link: approve
            ? "/dashboard/creator/courses"
            : `/dashboard/creator/courses/${courseId}/edit`,
        },
      });
      return true;
    });
    if (!applied) return { success: false, error: "INVALID_STATE" };

    void auditLog({
      action: approve
        ? AuditActions.ADMIN_COURSE_APPROVED
        : AuditActions.ADMIN_COURSE_REJECTED,
      userId: session.user.id,
      targetType: "Course",
      targetId: courseId,
      metadata: { title: course.title, note: cleanNote },
      severity: "CRITICAL",
    });

    void sendMail(
      approve
        ? courseApprovedEmail(course.creator.email, course.creator.name, course.title, cleanNote ?? undefined)
        : courseRejectedEmail(course.creator.email, course.creator.name, course.title, cleanNote ?? "")
    ).catch((err) => console.error("[REVIEW_COURSE_EMAIL]", err));

    await cacheInvalidatePattern(CacheKeys.patterns.allCourses);
    revalidatePath("/dashboard/admin/courses");
    revalidatePath("/dashboard/creator/courses");
    revalidatePath(`/dashboard/creator/courses/${courseId}/edit`);
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath("/courses");

    return { success: true, status: approve ? "PUBLISHED" : "DRAFT" };
  } catch (error) {
    console.error("[REVIEW_COURSE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}
