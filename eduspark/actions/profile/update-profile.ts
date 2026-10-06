"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Schema ───────────────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters.")
    .max(60, "Name must be at most 60 characters.")
    .regex(
      /^[a-zA-Z\u0600-\u06FF\s'-]+$/,
      "Name contains invalid characters."
    )
    .trim(),

  headline: z
    .string()
    .max(100, "Headline must be at most 100 characters.")
    .trim()
    .optional()
    .or(z.literal("")),

  bio: z
    .string()
    .max(500, "Bio must be at most 500 characters.")
    .trim()
    .optional()
    .or(z.literal("")),

  website: z
    .string()
    .url("Website must be a valid URL.")
    .max(200, "Website is too long.")
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export type UpdateProfileResult =
  | { success: true }
  | {
      success: false;
      error: "UNAUTHORIZED" | "INVALID_INPUT" | "SERVER_ERROR";
      fieldErrors?: Partial<Record<keyof UpdateProfileInput, string[]>>;
    };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function updateProfileAction(
  rawInput: UpdateProfileInput
): Promise<UpdateProfileResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };

    const parsed = UpdateProfileSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "INVALID_INPUT",
        fieldErrors: parsed.error.flatten()
          .fieldErrors as Partial<
          Record<keyof UpdateProfileInput, string[]>
        >,
      };
    }

    const { name, headline, bio, website } = parsed.data;

    await db.user.update({
      where: { id: session.user.id },
      data: {
        name,
        headline: headline || null,
        bio: bio || null,
        website: website || null,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_PROFILE_ACTION]", error);
    return { success: false, error: "SERVER_ERROR" };
  }
}