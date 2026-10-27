import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let cached: Transporter | null | undefined;

function transporter(): Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) return (cached = null);
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });
  return cached;
}

/**
 * Sends an email. Never throws: callers (sign-up, password reset) must not
 * fail or leak information because the mail server is down.
 * Returns true only when the SMTP server accepted the message.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const t = transporter();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    } else {
      console.warn("[MAIL] SMTP_HOST is not configured — email NOT sent.");
    }
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM ?? "EduSpark <no-reply@eduspark.local>",
      ...msg,
    });
    return true;
  } catch (err) {
    console.error("[MAIL] send failed:", err);
    return false;
  }
}
