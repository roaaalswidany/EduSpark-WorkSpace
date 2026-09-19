"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Role, ServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

// ─── Validation Schema ────────────────────────────────────────────────────────

export const CreateServiceSchema = z.object({
  courseId: z.string().cuid("Please select a valid certified course."),

  categoryId: z
    .string()
    .cuid("Please select a valid category.")
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? null : v)),

  title: z
    .string()
    .min(10, "Title must be at least 10 characters.")
    .max(100, "Title must be at most 100 characters.")
    .trim(),

  description: z
    .string()
    .min(50, "Description must be at least 50 characters.")
    .max(3000, "Description must be at most 3000 characters.")
    .trim(),

  price: z
    .number({ invalid_type_error: "Price must be a number." })
    .min(5, "Minimum price is $5.")
    .max(10_000, "Maximum price is $10,000.")
    .multipleOf(0.01, "Price can have at most 2 decimal places."),

  deliveryDays: z
    .number({ invalid_type_error: "Delivery time must be a number." })
    .int("Delivery time must be a whole number.")
    .min(1, "Minimum delivery is 1 day.")
    .max(90, "Maximum delivery is 90 days."),

  revisions: z
    .number({ invalid_type_error: "Revisions must be a number." })
    .int()
    .min(0, "Revisions cannot be negative.")
    .max(20, "Maximum revisions is 20.")
    .default(1),

  tags: z
    .array(
      z
        .string()
        .min(2, "Tag must be at least 2 characters.")
        .max(30, "Tag must be at most 30 characters.")
        .toLowerCase()
        .trim()
    )
    .min(1, "Add at least 1 tag.")
    .max(5, "Maximum 5 tags allowed.")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Tags must be unique.",
    }),

  portfolioLinks: z
    .array(
      z
        .string()
        .url("Each portfolio link must be a valid URL.")
        .max(500, "URL is too long.")
    )
    .max(5, "Maximum 5 portfolio links.")
    .default([]),
});

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

// ─── Result Types ─────────────────────────────────────────────────────────────

export type CreateServiceResult =
  | { success: true; serviceId: string; slug: string }
  | {
      success: false;
      error:
        | "UNAUTHORIZED"
        | "FORBIDDEN_ROLE"
        | "NO_CERTIFICATE"
        | "INVALID_INPUT"
        | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof CreateServiceInput, string[]>>;
    };

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
        fieldErrors: parsed.error.flatten().fieldErrors as Partial
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
    const certificate = await db.certificate.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      select: { id: true },
    });

    if (!certificate) {
      return { success: false, error: "NO_CERTIFICATE" };
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