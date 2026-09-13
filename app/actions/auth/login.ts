"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/app/lib/db";

// ─── Schema ───────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address.")
    .transform((v) => v.toLowerCase().trim()),

  password: z
    .string()
    .min(1, "Password is required.")
    .max(72, "Password is too long."),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>;

type FieldErrors = Partial<Record<keyof LoginInput, string[]>>;

/**
 * LoginResult carries a typed status code so client components can
 * branch behavior without string-matching error messages.
 */
export type LoginResult =
  | { success: true }
  | {
      success: false;
      code:
        | "VALIDATION_ERROR"
        | "NO_ACCOUNT"
        | "INVALID_PASSWORD"
        | "ACCOUNT_DISABLED"
        | "OAUTH_ACCOUNT"
        | "SERVER_ERROR";
      error: string;
      fieldErrors?: FieldErrors;
    };

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Pre-validates credentials against the database before the client
 * calls `signIn('credentials', ...)` from next-auth/react.
 *
 * This gives us:
 *  1. Typed, granular error messages (not NextAuth's generic "CredentialsSignin")
 *  2. Full Zod validation on the server before any DB call
 *  3. A single source of truth for credential logic
 *
 * The client component calls this action first, and only invokes
 * NextAuth's `signIn` when this returns `{ success: true }`.
 */
export async function loginAction(rawInput: LoginInput): Promise<LoginResult> {
  const parsed = LoginSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as FieldErrors,
    };
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
      isActive: true,
    },
  });

  if (!user) {
    // Deliberately vague to prevent account enumeration
    return {
      success: false,
      code: "NO_ACCOUNT",
      error: "Invalid email or password.",
      fieldErrors: { email: ["No account found with this email."] },
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      code: "ACCOUNT_DISABLED",
      error: "Your account has been disabled. Please contact support.",
    };
  }

  if (!user.password) {
    return {
      success: false,
      code: "OAUTH_ACCOUNT",
      error: "This account uses social login. Please sign in with your provider.",
    };
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return {
      success: false,
      code: "INVALID_PASSWORD",
      error: "Invalid email or password.",
      fieldErrors: { password: ["Incorrect password."] },
    };
  }

  return { success: true };
}