"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { getFreshUser } from "@/lib/security/fresh-user";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";
import {
  CreateServiceSchema,
  type CreateServiceInput,
} from "./create-service-schema";
import { scanUrls } from "@/lib/virustotal";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { auditLog, AuditActions } from "@/lib/security/audit";

// ─── Schema ───────────────────────────────────────────────────────

const UpdateServiceSchema = CreateServiceSchema.extend({
  serviceId: z.string().cuid("Invalid service ID."),
});

// ─── Result Types ─────────────────────────────────────────────────

export type UpdateServiceResult =
  | { success: true; serviceId: string; slug: string; sentToReview: boolean }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "NO_CERTIFICATE"
        | "INVALID_INPUT"
        | "MALICIOUS_URL_BLOCKED"
        | "CONFLICT"
        | "SERVER_ERROR"
        | "RATE_LIMITED";
      fieldErrors?: Partial<Record<keyof CreateServiceInput, string[]>>;
    };

// ─── Action ───────────────────────────────────────────────────────

export async function updateServiceAction(
  rawInput: CreateServiceInput & { serviceId: string }
): Promise<UpdateServiceResult> {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;
    // Authoritative role (JWT may be stale): decides whether the certificate gate is bypassed.
    const actor = await getFreshUser(userId);
    if (!actor?.isActive) return { success: false, error: "UNAUTHORIZED" };
    const role = actor.role;

    // Rate limit (protects the VirusTotal quota and the DB)
    const retryAfter = await limitByUser(RateLimits.SERVICE_WRITE, userId);
    if (retryAfter !== null) return { success: false, error: "RATE_LIMITED" };

    // 2. Validate
    const parsed = UpdateServiceSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten().fieldErrors as Partial<
          Record<keyof CreateServiceInput, string[]>
        >,
      };
    }

    const {
      serviceId,
      courseId,
      categoryId: userCategoryId,
      title,
      description,
      price,
      deliveryDays,
      revisions,
      tags,
      portfolioLinks,
    } = parsed.data;

    // The category is DERIVED from the certificate's course (creators)
    // or taken from user input (admins). Default to user input.
    let effectiveCategoryId: string | null = userCategoryId;

    // 3. Verify service exists and belongs to user
    const existing = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        creatorId: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        portfolioLinks: true,
      },
    });

    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.creatorId !== userId) {
      return { success: false, error: "FORBIDDEN" };
    }

    // 4. Certificate ownership gate
    // Admins bypass certificate requirement and keep their chosen category.
    if (role !== Role.ADMIN) {
      const certificate = await db.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: {
          id: true,
          course: {
            select: { categoryId: true },
          },
        },
      });

      if (!certificate) return { success: false, error: "NO_CERTIFICATE" };

      // 🔒 Lock the category to the certificate's course category.
      if (certificate.course.categoryId) {
        effectiveCategoryId = certificate.course.categoryId;
      } else {
        effectiveCategoryId = null;
      }
    }

    // 4.5. Security scan — only NEW links (unchanged links were already scanned).
    // Fail-open on errors/timeouts (see create-service.ts for rationale).
    const newLinks = portfolioLinks.filter(
      (l) => l && !existing.portfolioLinks.includes(l)
    );
    const scanResults = await scanUrls(newLinks);
    const malicious = scanResults.filter((r) => r.status === "malicious");
    if (malicious.length > 0) {
      return {
        success: false,
        error: "MALICIOUS_URL_BLOCKED",
        fieldErrors: {
          portfolioLinks: [
            `Blocked by VirusTotal: ${malicious.map((r) => r.url).join(", ")}`,
          ],
        },
      };
    }
    scanResults
      .filter((r) => r.status === "error" || r.status === "disabled" || r.status === "unknown")
      .forEach((r) =>
        console.warn(
          "[UPDATE_SERVICE] URL scan did not complete (fail-open):",
          r.url,
          r.status,
          r.errorMessage
        )
      );

    // 5. Update service
    //
    // An approved service is what the admin looked at. If the creator changes the parts a reviewer
    // judges (title, description, portfolio links), the service goes back to review instead of
    // silently showing unreviewed content. Price, delivery time, revisions and tags are not content
    // moderation and do not trigger a review. Admins are trusted and never re-queue their own edits.
    const sameLinks =
      JSON.stringify([...existing.portfolioLinks].sort()) ===
      JSON.stringify([...portfolioLinks].sort());
    const materialChange =
      existing.title.trim() !== title.trim() ||
      existing.description.trim() !== description.trim() ||
      !sameLinks;
    const sendToReview =
      existing.status === "ACTIVE" && materialChange && role !== Role.ADMIN;

    // Compare-and-set on the status we just read: if an admin approved/paused the service in the
    // meantime, we must not overwrite their decision with a stale one.
    const res = await db.service.updateMany({
      where: { id: serviceId, status: existing.status },
      data: {
        title,
        description,
        price,
        deliveryDays,
        revisions,
        tags,
        portfolioLinks,
        categoryId: effectiveCategoryId,
        ...(sendToReview
          ? { status: "PENDING_REVIEW" as const, submittedAt: new Date(), reviewNote: null }
          : {}),
      },
    });
    if (res.count !== 1) return { success: false, error: "CONFLICT" };
    const updated = { id: serviceId, slug: existing.slug };

    if (sendToReview) {
      await notifyAdmins({
        title: "Service awaiting review",
        body: `"${title}" was edited and needs another review.`,
        link: "/dashboard/admin/services?status=PENDING_REVIEW",
        exceptUserId: userId,
      });
      void auditLog({
        action: AuditActions.SERVICE_SUBMITTED_FOR_REVIEW,
        userId,
        targetType: "Service",
        targetId: serviceId,
        metadata: { title, reason: "content edited after approval" },
      });
    }

    // 6. Revalidate
    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/services/${updated.slug}`);

    await cacheInvalidatePattern(CacheKeys.patterns.allServices);

    return { success: true, serviceId: updated.id, slug: updated.slug, sentToReview: sendToReview };
  } catch (error) {
    console.error("[UPDATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}