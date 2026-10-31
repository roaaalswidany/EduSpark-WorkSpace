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

// ─── Broadcast Notification ───────────────────────────────────────
const BroadcastSchema = z.object({
  title: z.string().min(3).max(100),
  body: z.string().min(5).max(500),
});

export async function broadcastNotificationAction(
  input: z.infer<typeof BroadcastSchema>
) {
  try {
    await requireAdmin();
    const { title, body } = BroadcastSchema.parse(input);

    // Fetch all active users
    const users = await db.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // Create notification for each user
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        body,
        link: null, // Broadcast notifications have no specific target page
      })),
    });

    revalidatePath("/dashboard/admin");
    return { success: true, count: users.length };
  } catch (error) {
    return { success: false, error: "Failed to broadcast" };
  }
}