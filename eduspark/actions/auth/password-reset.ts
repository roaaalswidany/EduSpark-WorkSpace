"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PasswordSchema } from "@/lib/validation/password";
import { issueEmailToken, consumeEmailToken } from "@/lib/auth/email-tokens";
import { appUrl, passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/email/mailer";
import { checkRateLimit, getClientIdentifier, RateLimits } from "@/lib/security/rate-limit";

const EmailSchema = z
  .string()
  .email("Please enter a valid email address.")
  .max(255)
  .transform((v) => v.toLowerCase().trim());

export type RequestResetResult = { success: true } | { success: false; error: string };

/**
 * Always answers `success: true` for a well-formed email — whether or not the
 * account exists — so this endpoint cannot be used to enumerate users.
 */
export async function requestPasswordResetAction(rawEmail: unknown): Promise<RequestResetResult> {
  const parsed = EmailSchema.safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  const email = parsed.data;

  const ip = getClientIdentifier(await headers());
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(RateLimits.PASSWORD_RESET, ip),
    checkRateLimit(RateLimits.PASSWORD_RESET, `email:${email}`),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { name: true, isActive: true },
    });
    if (user?.isActive) {
      const token = await issueEmailToken("reset-password", email, 60);
      const url = `${appUrl()}/auth/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
      await sendMail(passwordResetEmail(email, user.name, url));
    }
  } catch (err) {
    console.error("[PASSWORD_RESET_REQUEST]", err); // still answer generically
  }
  return { success: true };
}

const ResetSchema = z
  .object({
    email: EmailSchema,
    token: z.string().length(64),
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Partial<Record<"password" | "confirmPassword", string[]>> };

export async function resetPasswordAction(input: z.input<typeof ResetSchema>): Promise<ResetPasswordResult> {
  const ip = getClientIdentifier(await headers());
  const limit = await checkRateLimit(RateLimits.PASSWORD_RESET, `reset-attempt:${ip}`);
  if (!limit.allowed) return { success: false, error: "Too many attempts. Please try again later." };

  const parsed = ResetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as never,
    };
  }
  const { email, token, password } = parsed.data;

  // Single-use, atomic: only one request can ever spend a given token.
  if (!(await consumeEmailToken("reset-password", email, token))) {
    return { success: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, isActive: true, emailVerified: true },
  });
  if (!user?.isActive) {
    return { success: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, 12),
      // Receiving the email proves mailbox ownership.
      emailVerified: user.emailVerified ?? new Date(),
    },
  });
  void sendMail(passwordChangedEmail(email, user.name));
  return { success: true };
}
