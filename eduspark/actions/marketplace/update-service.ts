"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  CreateServiceSchema,
  type CreateServiceInput,
} from "./create-service-schema";

// ─── Schema ───────────────────────────────────────────────────────────────────

const UpdateServiceSchema = CreateServiceSchema.extend({
  serviceId: z.string().cuid("Invalid service ID."),
});

// ─── Result Types ─────────────────────────────────────────────────────────────

export type UpdateServiceResult =
  | { success: true; serviceId: string; slug: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "NO_CERTIFICATE"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof CreateServiceInput, string[]>>;
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function updateServiceAction(
  rawInput: CreateServiceInput & { serviceId: string }
): Promise<UpdateServiceResult> {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const userId = session.user.id;

    // 2. Validate
    const parsed = UpdateServiceSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten()
          .fieldErrors as Partial<
          Record<keyof CreateServiceInput, string[]>
        >,
      };
    }

    const {
      serviceId,
      courseId,
      categoryId,
      title,
      description,
      price,
      deliveryDays,
      revisions,
      tags,
      portfolioLinks,
    } = parsed.data;

    // 3. Verify service exists and belongs to user
    const existing = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, creatorId: true, slug: true },
    });

    if (!existing) return { success: false, error: "NOT_FOUND" };
    if (existing.creatorId !== userId) {
      return { success: false, error: "FORBIDDEN" };
    }

    // 4. Re-verify certificate (user must still own it)
    const certificate = await db.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });

    if (!certificate) return { success: false, error: "NO_CERTIFICATE" };

    // 5. Update service
    const updated = await db.service.update({
      where: { id: serviceId },
      data: {
        title,
        description,
        price,
        deliveryDays,
        revisions,
        tags,
        portfolioLinks,
        categoryId: categoryId ?? null,
      },
      select: { id: true, slug: true },
    });

    // 6. Revalidate
    revalidatePath("/dashboard/creator/services");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/services/${updated.slug}`);

    return { success: true, serviceId: updated.id, slug: updated.slug };
  } catch (error) {
    console.error("[UPDATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}