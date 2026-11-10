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
import { serviceApprovedEmail, serviceRejectedEmail } from "@/lib/email/templates";
import { auditLog, AuditActions } from "@/lib/security/audit";

const ReviewSchema = z
  .object({
    serviceId: z.string().cuid(),
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(1000).optional(),
  })
  // Rejecting without telling the creator why is useless: a note is mandatory.
  .refine((d) => d.decision === "APPROVE" || (d.note?.length ?? 0) >= 10, {
    message: "A rejection needs a note of at least 10 characters.",
    path: ["note"],
  });

export type ReviewServiceResult =
  | { success: true; status: "ACTIVE" | "PAUSED" }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "INVALID_INPUT"
        | "INVALID_STATE"
        | "SERVER_ERROR";
    };

/**
 * Admin decision on a service submitted for review.
 * APPROVE → ACTIVE (visible in the marketplace, can be ordered)
 * REJECT  → PAUSED with a mandatory note the creator sees; they fix it and resubmit.
 * (Rejecting is NOT archiving: archive is a separate, final moderation action.)
 */
export async function reviewServiceAction(
  input: z.infer<typeof ReviewSchema>
): Promise<ReviewServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    // Authoritative role from the DB — a forged/stale JWT role must not be enough.
    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    if (actor.role !== "ADMIN") return { success: false, error: "FORBIDDEN" };

    const parsed = ReviewSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { serviceId, decision, note } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        creatorId: true,
        creator: { select: { email: true, name: true } },
      },
    });
    if (!service) return { success: false, error: "NOT_FOUND" };
    if (service.status !== "PENDING_REVIEW") return { success: false, error: "INVALID_STATE" };

    const approve = decision === "APPROVE";
    const now = new Date();
    const cleanNote = note && note.length > 0 ? note : null;

    // Compare-and-set + notification in ONE transaction:
    // two admins clicking at once → exactly one decision is recorded.
    const applied = await db.$transaction(async (tx) => {
      const res = await tx.service.updateMany({
        where: { id: serviceId, status: "PENDING_REVIEW" },
        data: {
          status: approve ? "ACTIVE" : "PAUSED",
          reviewedAt: now,
          reviewedById: session.user.id,
          reviewNote: cleanNote,
        },
      });
      if (res.count !== 1) return false;

      await tx.notification.create({
        data: {
          userId: service.creatorId,
          title: approve ? "Service approved 🎉" : "Changes requested",
          body: approve
            ? `"${service.title}" is now live in the marketplace.`
            : `"${service.title}" needs changes: ${cleanNote}`,
          link: "/dashboard/creator/services",
        },
      });
      return true;
    });
    if (!applied) return { success: false, error: "INVALID_STATE" };

    void auditLog({
      action: approve ? AuditActions.ADMIN_SERVICE_APPROVED : AuditActions.ADMIN_SERVICE_REJECTED,
      userId: session.user.id,
      targetType: "Service",
      targetId: serviceId,
      metadata: { title: service.title, note: cleanNote },
      severity: "CRITICAL",
    });

    void sendMail(
      approve
        ? serviceApprovedEmail(service.creator.email, service.creator.name, service.title, cleanNote ?? undefined)
        : serviceRejectedEmail(service.creator.email, service.creator.name, service.title, cleanNote ?? "")
    ).catch((err) => console.error("[REVIEW_SERVICE_EMAIL]", err));

    await cacheInvalidatePattern(CacheKeys.patterns.allServices);
    revalidatePath("/dashboard/admin/services");
    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/services/${service.slug}`);

    return { success: true, status: approve ? "ACTIVE" : "PAUSED" };
  } catch (error) {
    console.error("[REVIEW_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}
