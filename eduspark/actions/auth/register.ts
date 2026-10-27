"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { headers } from "next/headers";
import { PasswordSchema } from "@/lib/validation/password";
import { sendVerificationEmail } from "@/lib/auth/verification-mail";
import { db } from "@/lib/db";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimits,
} from "@/lib/security/rate-limit";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters.")
      .max(60, "Name must be at most 60 characters.")
      .regex(/^[a-zA-Z\u0600-\u06FF\s'-]+$/, "Name contains invalid characters."),

    email: z
      .string()
      .email("Please enter a valid email address.")
      .max(255, "Email is too long.")
      .transform((v) => v.toLowerCase().trim()),

    password: PasswordSchema,

    confirmPassword: z.string(),

  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;

type FieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

type RegisterResult =
  | { success: true; userId: string }
  | { success: false; error: string; fieldErrors?: FieldErrors };

// ─── Action ───────────────────────────────────────────────────────────────────

export async function registerAction(
  rawInput: RegisterInput
): Promise<RegisterResult> {
  // ── Throttle sign-ups per client IP ───────────────────────────────────────
  const limit = await checkRateLimit(
    RateLimits.AUTH_REGISTER,
    getClientIdentifier(await headers())
  );
  if (!limit.allowed) {
    return {
      success: false,
      error: "Too many sign-up attempts. Please try again later.",
    };
  }

  const parsed = RegisterSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return {
      success: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: ["This email is already registered."] },
    };
  }

  // Cost factor 12: ~250ms on modern hardware — good balance for production
  const hashedPassword = await bcrypt.hash(password, 12);

  // SECURITY: every new account starts as STUDENT. The CREATOR role is earned
  // only by passing a course certification quiz (see submitQuizAction) or
  // granted by an ADMIN. Never accept a role from the client here.
  try {
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role: Role.STUDENT,
      },
      select: { id: true },
    });

    // Fire-and-forget: sign-up must succeed even if the mail server is down.
    void sendVerificationEmail(email, name.trim());

    return { success: true, userId: user.id };
  } catch (err) {
    // Race: two sign-ups with the same email passed the findUnique above.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        error: "An account with this email already exists.",
        fieldErrors: { email: ["This email is already registered."] },
      };
    }
    console.error("[REGISTER_ACTION]", err);
    return { success: false, error: "Could not create your account. Please try again." };
  }
}