"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimits,
} from "@/lib/security/rate-limit";

// ─── Schema ───────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>;

type FieldErrors = Partial<Record<keyof LoginInput, string[]>>;

export type LoginResult =
  | { success: true }
  | {
      success: false;
      code:
        | "VALIDATION_ERROR"
        | "RATE_LIMITED"
        | "NO_ACCOUNT"
        | "INVALID_PASSWORD"
        | "ACCOUNT_DISABLED"
        | "OAUTH_ACCOUNT"
        | "SERVER_ERROR";
      error: string;
      fieldErrors?: FieldErrors;
      retryAfterSec?: number;
    };

// ─── Action ───────────────────────────────────────────────────────

export async function loginAction(rawInput: LoginInput): Promise<LoginResult> {
  // ── 1. Validate input ─────────────────────────────────────────
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

  // ── 2. Rate limiting ──────────────────────────────────────────
  //   Layer A: per IP (prevents distributed brute force from one host)
  //   Layer B: per email (prevents targeted attacks from many IPs)
  const hdrs = await headers();
  const ipIdentifier = getClientIdentifier(hdrs);
  const emailIdentifier = `email:${email}`;

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(RateLimits.AUTH_LOGIN, ipIdentifier),
    checkRateLimit(RateLimits.AUTH_LOGIN, emailIdentifier),
  ]);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(
      ipLimit.retryAfterSec,
      emailLimit.retryAfterSec
    );
    const minutes = Math.ceil(retryAfter / 60);

    return {
      success: false,
      code: "RATE_LIMITED",
      error: `Too many login attempts. Please try again in ${minutes} minute${
        minutes === 1 ? "" : "s"
      }.`,
      retryAfterSec: retryAfter,
    };
  }

  // ── 3. Fetch user ─────────────────────────────────────────────
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

  // ── 4. Verify password ────────────────────────────────────────
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