"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { consumeEmailToken } from "@/lib/auth/email-tokens";
import { sendVerificationEmail } from "@/lib/auth/verification-mail";
import { limitByUser } from "@/lib/security/action-guard";
import { RateLimits } from "@/lib/security/rate-limit";

export type VerifyEmailResult = { success: true } | { success: false; error: string };

const VerifySchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  token: z.string().length(64),
});

/** Confirms the address. Triggered by a button click (not a GET) so mail scanners that pre-fetch links cannot burn the token. */
export async function verifyEmailAction(input: z.input<typeof VerifySchema>): Promise<VerifyEmailResult> {
  const parsed = VerifySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "This confirmation link is invalid." };
  const { email, token } = parsed.data;

  if (!(await consumeEmailToken("verify-email", email, token))) {
    return { success: false, error: "This confirmation link is invalid or has expired. Request a new one from your dashboard." };
  }
  await db.user.updateMany({
    where: { email, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  return { success: true };
}

/** Re-sends the confirmation email to the signed-in user. */
export async function resendVerificationEmailAction(): Promise<VerifyEmailResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Please sign in first." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, emailVerified: true, isActive: true },
  });
  if (!user?.isActive) return { success: false, error: "Account unavailable." };
  if (user.emailVerified) return { success: true };

  const wait = await limitByUser(RateLimits.EMAIL_VERIFY_SEND, session.user.id);
  if (wait !== null) return { success: false, error: "Too many requests. Please try again later." };

  const sent = await sendVerificationEmail(user.email, user.name);
  return sent ? { success: true } : { success: false, error: "We could not send the email right now. Please try again later." };
}
