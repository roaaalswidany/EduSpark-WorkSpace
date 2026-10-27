// ============================================================================
// Internal HTTP routes — server-to-server communication
// Called by Next.js when it needs to push real-time events to a specific user
// ============================================================================

import { Router, type Request, type Response } from "express";
import type { TypedServer } from "../types/socket.types";
import type { NotificationPayload } from "../types/socket.types";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { timingSafeEqual } from "crypto";

/** Constant-time comparison of the shared server-to-server secret. */
export function isValidInternalSecret(provided: unknown): boolean {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(env.INTERNAL_API_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface NotifyBody {
  userId: string;
  notification: NotificationPayload;
}

export function createInternalRouter(io: TypedServer): Router {
  const router = Router();

  // ── POST /internal/notify ───────────────────────────────────
  router.post(
    "/notify",
    (req: Request<unknown, unknown, NotifyBody>, res: Response) => {
      if (!isValidInternalSecret(req.headers["x-internal-secret"])) {
       logger.warn("Internal notify: unauthorized attempt", {
  meta: { ip: req.ip },
});
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { userId, notification } = req.body;

      if (!userId || !notification?.id) {
        return res
          .status(400)
          .json({ ok: false, error: "userId and notification required" });
      }

      io.to(`user:${userId}`).emit("notification_new", notification);

      logger.debug("Notification emitted via socket", {
        userId,
        notificationId: notification.id,
      });

      return res.json({ ok: true });
    }
  );

  return router;
}