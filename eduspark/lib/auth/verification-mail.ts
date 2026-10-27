import { issueEmailToken } from "@/lib/auth/email-tokens";
import { appUrl, verificationEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/email/mailer";

/** Issues a 24h token and emails the confirmation link. Never throws. */
export async function sendVerificationEmail(email: string, name: string): Promise<boolean> {
  try {
    const token = await issueEmailToken("verify-email", email, 24 * 60);
    const url = `${appUrl()}/auth/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
    return await sendMail(verificationEmail(email, name, url));
  } catch (err) {
    console.error("[VERIFY_EMAIL] could not send:", err);
    return false;
  }
}
