"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

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
    if (session.user.role !== "ADMIN") {
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
      select: { id: true, isActive: true, role: true },
    });
    if (!target) return { success: false, error: "NOT_FOUND" };

    if (action === "TOGGLE_ACTIVE") {
      await db.user.update({
        where: { id: userId },
        data: { isActive: !target.isActive },
      });
    } else if (action === "CHANGE_ROLE" && role) {
      await db.user.update({
        where: { id: userId },
        data: { role: role as Role },
      });
    }

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_USER_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}