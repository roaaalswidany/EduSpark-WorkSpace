import type { MailMessage } from "./mailer";

export const appUrl = () =>
  (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string) {
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;color:#e2e8f0">
<h2 style="color:#818cf8;margin:0 0 16px">EduSpark</h2>
<h3 style="margin:0 0 12px;color:#f1f5f9">${esc(title)}</h3>
${bodyHtml}
${ctaUrl ? `<p style="margin:28px 0"><a href="${esc(ctaUrl)}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(ctaLabel ?? "Open")}</a></p>
<p style="font-size:12px;color:#94a3b8;word-break:break-all">${esc(ctaUrl)}</p>` : ""}
<p style="font-size:12px;color:#64748b;margin-top:28px">If you did not request this, you can safely ignore this email.</p>
</div></body></html>`;
}

export function verificationEmail(to: string, name: string, url: string): MailMessage {
  return {
    to,
    subject: "Verify your EduSpark email · تأكيد بريدك الإلكتروني",
    text: `Hi ${name},\n\nConfirm your email address:\n${url}\n\nThis link expires in 24 hours.\n\nمرحبًا ${name}، أكّد بريدك الإلكتروني عبر الرابط أعلاه (صالح 24 ساعة).`,
    html: layout("Confirm your email address", `<p>Hi ${esc(name)}, confirm your email to unlock ordering, certification and publishing.</p><p dir="rtl">مرحبًا ${esc(name)}، أكّد بريدك الإلكتروني (الرابط صالح 24 ساعة).</p>`, url, "Confirm email"),
  };
}

export function passwordResetEmail(to: string, name: string, url: string): MailMessage {
  return {
    to,
    subject: "Reset your EduSpark password · إعادة تعيين كلمة المرور",
    text: `Hi ${name},\n\nReset your password:\n${url}\n\nThis link expires in 1 hour and can be used once.\n\nمرحبًا ${name}، لإعادة تعيين كلمة المرور استخدم الرابط أعلاه (صالح ساعة واحدة).`,
    html: layout("Reset your password", `<p>Hi ${esc(name)}, use the button below to choose a new password. The link expires in 1 hour and works once.</p><p dir="rtl">رابط إعادة التعيين صالح لمدة ساعة ويُستخدم مرة واحدة.</p>`, url, "Choose a new password"),
  };
}

export function passwordChangedEmail(to: string, name: string): MailMessage {
  return {
    to,
    subject: "Your EduSpark password was changed · تم تغيير كلمة المرور",
    text: `Hi ${name},\n\nYour password was just changed. If this was not you, reset it immediately and contact support.`,
    html: layout("Your password was changed", `<p>Hi ${esc(name)}, your password was just changed. If this was not you, reset it immediately.</p>`),
  };
}
