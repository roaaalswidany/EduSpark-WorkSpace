"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";
import { sendMail } from "@/lib/email/mailer";
import { serviceArchivedEmail } from "@/lib/email/templates";
import { auditLog, AuditActions } from "@/lib/security/audit";

const UpdateServiceSchema = z.object({
  serviceId: z.string().cuid(),
  action: z.enum(["CHANGE_STATUS"]),
  status: z.enum(["PENDING_REVIEW", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(), 
  // Optional rationale recorded in the audit log; required for archiving.
  reason: z.string().trim().max(500).optional(),
});

export type UpdateServiceResult =
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

export async function updateServiceAction(
  input: z.infer<typeof UpdateServiceSchema>
): Promise<UpdateServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive || actor.role !== "ADMIN") {
      return { success: false, error: "FORBIDDEN" };
    }

    const parsed = UpdateServiceSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { serviceId, action, status, reason } = parsed.data;

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        title: true,
        status: true,
        creator: { select: { email: true, name: true } },
      },
    });
    if (!service) return { success: false, error: "NOT_FOUND" };

    if (action === "CHANGE_STATUS" && status) {
      const oldStatus = service.status;

      // Archiving requires a rationale (only when transitioning TO ARCHIVED).
      if (
        status === "ARCHIVED" &&
        oldStatus !== "ARCHIVED" &&
        !reason?.trim()
      ) {
        return { success: false, error: "INVALID_INPUT" };
      }

      await db.service.update({
        where: { id: serviceId },
        data: { status: status as ServiceStatus },
      });

      // ── Audit trail — every status change is recorded ──
      void auditLog({
        action: AuditActions.ADMIN_SERVICE_STATUS_CHANGED,
        userId: session.user.id,
        targetType: "Service",
        targetId: serviceId,
        metadata: {
          title: service.title,
          previousStatus: oldStatus,
          newStatus: status,
          reason: reason?.trim() ?? null,
        },
        severity: "CRITICAL",
      });

      // Notify creator only on transition TO ARCHIVED
      if (status === "ARCHIVED" && oldStatus !== "ARCHIVED") {
        void sendMail(
          serviceArchivedEmail(
            service.creator.email,
            service.creator.name,
            service.title,
            reason?.trim()
          )
        ).catch((err) => console.error("[ADMIN_EMAIL_SERVICE]", err));
      }
    }

    await cacheInvalidatePattern(CacheKeys.patterns.allServices);

    revalidatePath("/dashboard/admin/services");
    revalidatePath("/marketplace");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}