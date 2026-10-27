"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getFreshUser } from "@/lib/security/fresh-user";
import { emailVerificationOk } from "@/lib/auth/email-policy";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { emitNotification } from "@/lib/notifications/emit";

const Schema = z.object({
  projectId: z.string().cuid(),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  comment: z
    .string()
    .max(1000, "Comment must be at most 1000 characters.")
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim())
    .optional(),
});

export type CreateProjectReviewResult =
  | { success: true; reviewId: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "NOT_COMPLETED" | "ALREADY_REVIEWED"
        | "RATE_LIMITED" | "EMAIL_NOT_VERIFIED" | "INVALID_INPUT" | "SERVER_ERROR";
      message?: string;
    };

/**
 * The CLIENT of a COMPLETED project rates the creator once (immutable).
 * Trust comes from the rule "no completed paid-for engagement, no review".
 */
export async function createProjectReviewAction(
  input: z.input<typeof Schema>
): Promise<CreateProjectReviewResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const userId = session.user.id;

    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (!emailVerificationOk(actor)) return { success: false, error: "EMAIL_NOT_VERIFIED" };

    const parsed = Schema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "INVALID_INPUT", message: parsed.error.issues[0]?.message };
    }
    const { projectId, rating, comment } = parsed.data;

    if ((await limitByUser(RateLimits.REVIEW_CREATE, userId)) !== null) {
      return { success: false, error: "RATE_LIMITED" };
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, title: true, status: true, clientId: true, creatorId: true, serviceId: true,
        service: { select: { slug: true } },
      },
    });
    if (!project) return { success: false, error: "NOT_FOUND" };
    if (project.clientId !== userId) return { success: false, error: "FORBIDDEN" };
    if (!project.creatorId) return { success: false, error: "NOT_FOUND" };
    if (project.status !== "COMPLETED") return { success: false, error: "NOT_COMPLETED" };

    let review;
    try {
      review = await db.projectReview.create({
        data: {
          projectId, rating, comment: comment || null,
          reviewerId: userId, creatorId: project.creatorId, serviceId: project.serviceId,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { success: false, error: "ALREADY_REVIEWED" }; // unique(projectId): concurrent double submit
      }
      throw err;
    }

    // Best-effort notification — never fails the review itself.
    try {
      const n = await db.notification.create({
        data: {
          userId: project.creatorId,
          title: "New client review ⭐",
          body: `${rating}/5 on "${project.title}"${comment ? ` — "${comment.slice(0, 120)}"` : ""}`,
          link: `/profile/${project.creatorId}`,
        },
      });
      void emitNotification({
        userId: project.creatorId,
        notification: { id: n.id, title: n.title, body: n.body, link: n.link, isRead: false, createdAt: n.createdAt.toISOString() },
      });
    } catch (err) {
      console.error("[CREATE_PROJECT_REVIEW] notify failed:", err);
    }

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/profile/${project.creatorId}`);
    if (project.service?.slug) revalidatePath(`/marketplace/services/${project.service.slug}`);

    return { success: true, reviewId: review.id };
  } catch (err) {
    console.error("[CREATE_PROJECT_REVIEW]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}
