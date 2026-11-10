"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";
import { getFreshUser } from "@/lib/security/fresh-user";
import { auditLog, AuditActions } from "@/lib/security/audit";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { creatorMayMoveService } from "@/lib/marketplace/service-status";

const UpdateStatusSchema = z.object({
  serviceId: z.string().cuid(),
  status: z.enum(["PENDING_REVIEW", "ACTIVE", "PAUSED", "ARCHIVED"]),
});

export type UpdateServiceStatusResult =
  | { success: true; newStatus: ServiceStatus }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "INVALID_TRANSITION"
        | "SERVER_ERROR";
    };

/**
 * Creator-side status changes. Allowed moves are fixed on the SERVER
 * (lib/marketplace/service-status.ts): a creator can pause, submit for review, withdraw or archive
 * a paused service — but can never activate one. Activation is an admin decision (review-service.ts).
 */
export async function updateServiceStatusAction(
  input: z.infer<typeof UpdateStatusSchema>
): Promise<UpdateServiceStatusResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const userId = session.user.id;

    // The JWT can outlive a suspension: read the real account state.
    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "FORBIDDEN" };

    const parsed = UpdateStatusSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };
    const { serviceId, status } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, creatorId: true, status: true, title: true, slug: true },
    });
    if (!service) return { success: false, error: "NOT_FOUND" };
    if (service.creatorId !== userId) return { success: false, error: "FORBIDDEN" };

    if (!creatorMayMoveService(service.status, status)) {
      return { success: false, error: "INVALID_TRANSITION" };
    }

    // Compare-and-set: the move only applies if the status is still what we just checked.
    const now = new Date();
    const res = await db.service.updateMany({
      where: { id: serviceId, status: service.status },
      data: {
        status: status as ServiceStatus,
        ...(status === "PENDING_REVIEW" ? { submittedAt: now, reviewNote: null } : {}),
      },
    });
    if (res.count !== 1) return { success: false, error: "INVALID_TRANSITION" };

    if (status === "PENDING_REVIEW") {
      await notifyAdmins({
        title: "Service awaiting review",
        body: `"${service.title}" was submitted for review.`,
        link: "/dashboard/admin/services?status=PENDING_REVIEW",
        exceptUserId: userId,
      });
      void auditLog({
        action: AuditActions.SERVICE_SUBMITTED_FOR_REVIEW,
        userId,
        targetType: "Service",
        targetId: serviceId,
        metadata: { title: service.title },
      });
    } else {
      void auditLog({
        action: AuditActions.SERVICE_STATUS_CHANGED,
        userId,
        targetType: "Service",
        targetId: serviceId,
        metadata: { title: service.title, from: service.status, to: status },
      });
    }

    revalidatePath("/dashboard/creator/services");
    revalidatePath("/dashboard/admin/services");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/services/${service.slug}`);
    await cacheInvalidatePattern(CacheKeys.patterns.allServices);

    return { success: true, newStatus: status as ServiceStatus };
  } catch (error) {
    console.error("[UPDATE_SERVICE_STATUS]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}
