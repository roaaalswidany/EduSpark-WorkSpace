// eduspark/lib/notifications/notify-admins.ts
//
// Best-effort in-app notification to every other active admin (e.g. "something awaits review").
// Never throws: a failed notification must not fail the user's action.

import { db } from "@/lib/db";

export async function notifyAdmins(opts: {
  title: string;
  body: string;
  link: string;
  exceptUserId?: string;
}): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
        ...(opts.exceptUserId ? { id: { not: opts.exceptUserId } } : {}),
      },
      select: { id: true },
      take: 50,
    });
    if (admins.length === 0) return;
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: opts.title,
        body: opts.body,
        link: opts.link,
      })),
    });
  } catch (err) {
    console.error("[NOTIFY_ADMINS]", err);
  }
}
