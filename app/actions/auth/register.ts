"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { db } from "@/app/lib/db";

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

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters.")  // bcrypt hard limit
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),

    confirmPassword: z.string(),

    role: z.enum([Role.STUDENT, Role.CREATOR]).default(Role.STUDENT),
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
  const parsed = RegisterSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  const { name, email, password, role } = parsed.data;

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

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email,
      password: hashedPassword,
      role,
    },
    select: { id: true },
  });

  return { success: true, userId: user.id };
}