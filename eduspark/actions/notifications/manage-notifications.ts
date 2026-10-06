"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const IdSchema = z.object({ id: z.string().cuid("Invalid notification ID.") });

export type NotifActionResult =
  | { success: true }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
    };

export async function markNotificationReadAction(
  input: z.infer<typeof IdSchema>
): Promise<NotifActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const notif = await db.notification.findUnique({
      where: { id: parsed.data.id },
      select: { userId: true, isRead: true },
    });
    if (!notif) return { success: false, error: "NOT_FOUND" };
    if (notif.userId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    if (!notif.isRead) {
      await db.notification.update({
        where: { id: parsed.data.id },
        data: { isRead: true },
      });
    }

    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[MARK_NOTIFICATION_READ]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotifActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    await db.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[MARK_ALL_READ]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}

export async function deleteNotificationAction(
  input: z.infer<typeof IdSchema>
): Promise<NotifActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = IdSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

    const notif = await db.notification.findUnique({
      where: { id: parsed.data.id },
      select: { userId: true },
    });
    if (!notif) return { success: false, error: "NOT_FOUND" };
    if (notif.userId !== session.user.id) {
      return { success: false, error: "FORBIDDEN" };
    }

    await db.notification.delete({ where: { id: parsed.data.id } });

    revalidatePath("/dashboard/notifications");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[DELETE_NOTIFICATION]", err);
    return { success: false, error: "SERVER_ERROR" };
  }
}