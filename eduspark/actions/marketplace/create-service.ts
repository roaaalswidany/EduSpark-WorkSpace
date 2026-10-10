"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cacheInvalidatePattern } from "@/lib/cache";
import { CacheKeys } from "@/lib/cache-keys";
import {
  CreateServiceSchema,
  type CreateServiceInput,
  type CreateServiceResult,
} from "./create-service-schema";

// ─── Slug Utilities ───────────────────────────────────────────────

function toBaseSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function resolveUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  while (true) {
    const conflict = await db.service.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!conflict) return candidate;
    candidate = `${base}-${n++}`;
  }
}

// ─── Server Action ────────────────────────────────────────────────

export async function createServiceAction(
  rawInput: CreateServiceInput
): Promise<CreateServiceResult> {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const { id: userId, role } = session.user;

    // 2. Role gate: only CREATOR and ADMIN may create services
    if (role !== Role.CREATOR && role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN_ROLE" };
    }

    // 3. Input validation
    const parsed = CreateServiceSchema.safeParse(rawInput);
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

    // 4. Certificate ownership gate
    // Admins bypass certificate requirement and keep their chosen category.
    if (role !== Role.ADMIN) {
      const certificate = await db.certificate.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
        select: {
          id: true,
          course: {
            select: { categoryId: true },
          },
        },
      });

      if (!certificate) {
        return { success: false, error: "NO_CERTIFICATE" };
      }

      // 🔒 Lock the category to the certificate's course category.
      // This prevents a creator from offering a service in a category
      // they have not been certified in.
      if (certificate.course.categoryId) {
        effectiveCategoryId = certificate.course.categoryId;
      } else {
        // If the certified course has no category, force null
        // rather than accepting an arbitrary user-supplied category.
        effectiveCategoryId = null;
      }
    }

    // 5. Unique slug generation
    const slug = await resolveUniqueSlug(toBaseSlug(title));

    // 6. Persist service
    const service = await db.service.create({
      data: {
        title,
        slug,
        description,
        price,
        deliveryDays,
        revisions,
        tags,
        portfolioLinks,
        status: ServiceStatus.ACTIVE,
        creatorId: userId,
        categoryId: effectiveCategoryId,
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/marketplace");
    revalidatePath("/dashboard/creator/services");

    await cacheInvalidatePattern(CacheKeys.patterns.allServices);

    return { success: true, serviceId: service.id, slug: service.slug };
  } catch (error) {
    console.error("[CREATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}