/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─── Helper: Check Admin Auth ──────────────────────────────────────
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

// ─── 1. Update User Role ───────────────────────────────────────────
const RoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(Role),
});

export async function updateUserRoleAction(input: z.infer<typeof RoleSchema>) {
  try {
    await requireAdmin();
    const { userId, role } = RoleSchema.parse(input);

    await db.user.update({ where: { id: userId }, data: { role } });
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update role" };
  }
}

// ─── 2. Toggle User Status (Ban/Unban) ─────────────────────────────
export async function toggleUserStatusAction(userId: string) {
  try {
    await requireAdmin();
    const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user) return { success: false, error: "User not found" };

    await db.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to toggle status" };
  }
}

// ─── 3. Broadcast Notification ─────────────────────────────────────
const BroadcastSchema = z.object({
  title: z.string().min(3).max(100),
  body: z.string().min(5).max(500),
});

export async function broadcastNotificationAction(input: z.infer<typeof BroadcastSchema>) {
  try {
    await requireAdmin();
    const { title, body } = BroadcastSchema.parse(input);

    // Fetch all active users
    const users = await db.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // Create notification for each user (using createMany for performance)
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        body,
        link: "/dashboard", // Redirect to dashboard when clicked
      })),
    });

    revalidatePath("/dashboard/admin");
    return { success: true, count: users.length };
  } catch (error) {
    return { success: false, error: "Failed to broadcast" };
  }
}