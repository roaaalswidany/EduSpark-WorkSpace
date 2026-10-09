// eduspark/lib/security/audit.ts
import { headers } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditEvent {
  action: string;
  userId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

// ─── Standard Action Names ────────────────────────────────────────
// Central catalog — prevents typos.

export const AuditActions = {
  // Auth
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_LOGIN_RATE_LIMITED: "auth.login.rate_limited",
  AUTH_LOGOUT: "auth.logout",
  AUTH_REGISTER: "auth.register",

  // Admin
  ADMIN_ROLE_CHANGED: "admin.role.changed",
  ADMIN_USER_SUSPENDED: "admin.user.suspended",
  ADMIN_USER_ACTIVATED: "admin.user.activated",
  ADMIN_COURSE_STATUS_CHANGED: "admin.course.status_changed",
  ADMIN_SERVICE_STATUS_CHANGED: "admin.service.status_changed",

  // Creator
  SERVICE_CREATED: "creator.service.created",
  SERVICE_UPDATED: "creator.service.updated",
  SERVICE_DELETED: "creator.service.deleted",

  // Commerce
  ORDER_CREATED: "order.created",
  ORDER_COMPLETED: "order.completed",

  // AI
  AI_CAREER_PATH_CREATED: "ai.career_path.created",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

// ─── Core Logger ──────────────────────────────────────────────────

/**
 * Log a security-relevant event. Designed to be fire-and-forget safe.
 *
 * Usage:
 *   await auditLog({ action: AuditActions.AUTH_LOGIN_SUCCESS, userId });
 *
 * Or fire-and-forget:
 *   void auditLog({ ... }).catch(() => {});
 */
export async function auditLog(
  event: AuditEvent,
  tx?: PrismaClient
): Promise<void> {
  const db = tx ?? defaultDb;

  try {
    // Extract request context (best-effort — non-fatal if fails)
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    try {
      const hdrs = await headers();
      const forwarded = hdrs.get("x-forwarded-for");
      const realIp = hdrs.get("x-real-ip");
      ipAddress = forwarded?.split(",")[0]?.trim() ?? realIp ?? null;
      userAgent = hdrs.get("user-agent");
    } catch {
      // headers() unavailable (e.g. in background job) — continue without
    }

    await db.auditLog.create({
      data: {
        userId: event.userId ?? null,
        action: event.action,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        metadata: event.metadata
          ? (event.metadata as never)
          : undefined,
        ipAddress,
        userAgent: userAgent?.slice(0, 500) ?? null, // truncate long UAs
        severity: event.severity ?? "INFO",
      },
    });
  } catch (err) {
    // Audit failures must never break the main operation.
    console.error("[AUDIT] Failed to log event:", event.action, err);
  }
}