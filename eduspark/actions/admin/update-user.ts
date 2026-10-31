"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFreshUser } from "@/lib/security/fresh-user";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog, AuditActions } from "@/lib/security/audit";
import { sendMail } from "@/lib/email/mailer";
import {
  accountSuspendedEmail,
  accountReactivatedEmail,
  roleChangedEmail,
} from "@/lib/email/templates";

const UpdateUserSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["TOGGLE_ACTIVE", "CHANGE_ROLE"]),
  role: z.enum(["STUDENT", "CREATOR", "ADMIN"]).optional(),
});

export type UpdateUserResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "INVALID_INPUT"
        | "CANNOT_MODIFY_SELF"
        | "SERVER_ERROR";
    };

export async function updateUserAction(
  input: z.infer<typeof UpdateUserSchema>
): Promise<UpdateUserResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    const actor = await getFreshUser(session.user.id);
    if (!actor?.isActive || actor.role !== "ADMIN") {
      return { success: false, error: "FORBIDDEN" };
    }

    const parsed = UpdateUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const { userId, action, role } = parsed.data;

    // Prevent admin from modifying themselves
    if (userId === session.user.id) {
      return { success: false, error: "CANNOT_MODIFY_SELF" };
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        role: true,
        name: true,
        email: true,
      },
    });
    if (!target) return { success: false, error: "NOT_FOUND" };

    // ── Apply change + audit log + email notification ─────────────
    if (action === "TOGGLE_ACTIVE") {
      const willBeActive = !target.isActive;

      await db.user.update({
        where: { id: userId },
        data: { isActive: willBeActive },
      });

      void auditLog({
        action: willBeActive
          ? AuditActions.ADMIN_USER_ACTIVATED
          : AuditActions.ADMIN_USER_SUSPENDED,
        userId: session.user.id,
        targetType: "User",
        targetId: userId,
        metadata: {
          targetName: target.name,
          previousState: target.isActive,
          newState: willBeActive,
        },
        severity: "CRITICAL",
      });

      // Fire-and-forget email — never blocks or fails the action
      void sendMail(
        willBeActive
          ? accountReactivatedEmail(target.email, target.name)
          : accountSuspendedEmail(target.email, target.name)
      ).catch((err) => console.error("[ADMIN_EMAIL_STATUS]", err));
    } else if (action === "CHANGE_ROLE" && role) {
      const oldRole = target.role;

      // No-op if role is unchanged
      if (oldRole !== role) {
        await db.user.update({
          where: { id: userId },
          data: { role: role as Role },
        });

        void auditLog({
          action: AuditActions.ADMIN_ROLE_CHANGED,
          userId: session.user.id,
          targetType: "User",
          targetId: userId,
          metadata: {
            targetName: target.name,
            previousRole: oldRole,
            newRole: role,
          },
          severity: "CRITICAL",
        });

        void sendMail(
          roleChangedEmail(target.email, target.name, oldRole, role)
        ).catch((err) => console.error("[ADMIN_EMAIL_ROLE]", err));
      }
    }

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_USER_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}