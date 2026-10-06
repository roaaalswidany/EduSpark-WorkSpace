"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  CreateServiceSchema,
  type CreateServiceInput,
  type CreateServiceResult,
} from "./create-service-schema";

// ─── Slug Utilities ───────────────────────────────────────────────────────────

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


// ─── Server Action ────────────────────────────────────────────────────────────

export async function createServiceAction(
  rawInput: CreateServiceInput
): Promise<CreateServiceResult> {
  try {
    // ── 1. Authentication ─────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const { id: userId, role } = session.user;

    // ── 2. Role gate: only CREATOR and ADMIN may create services ──────────────
    if (role !== Role.CREATOR && role !== Role.ADMIN) {
      return { success: false, error: "FORBIDDEN_ROLE" };
    }

    // ── 3. Input validation ───────────────────────────────────────────────────
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
      categoryId,
      title,
      description,
      price,
      deliveryDays,
      revisions,
      tags,
      portfolioLinks,
    } = parsed.data;

    // ── 4. Certificate ownership gate ─────────────────────────────────────────
    //    The creator MUST hold a certificate for the exact course they claim
    //    expertise in. This check runs server-side on every submission;
    //    the client's courseId selection is never trusted in isolation.
   // Admins bypass certificate requirement (they manage the whole platform)
if (role !== Role.ADMIN) {
  const certificate = await db.certificate.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
    select: { id: true },
  });

  if (!certificate) {
    return { success: false, error: "NO_CERTIFICATE" };
  }
}

    // ── 5. Unique slug generation ─────────────────────────────────────────────
    const slug = await resolveUniqueSlug(toBaseSlug(title));

    // ── 6. Persist service ────────────────────────────────────────────────────
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
        categoryId: categoryId ?? null,
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/marketplace");
    revalidatePath("/dashboard/creator/services");

    return { success: true, serviceId: service.id, slug: service.slug };
  } catch (error) {
    console.error("[CREATE_SERVICE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}