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


// ─────────────────────────────────────────────────────────────────────────
// Admin action notifications (sent to affected users)
// ─────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  CREATOR: "Creator",
  ADMIN: "Administrator",
};

export function accountSuspendedEmail(
  to: string,
  name: string,
  reason?: string
): MailMessage {
  return {
    to,
    subject: "Your EduSpark account has been suspended",
    text: `Hi ${name},\n\nYour EduSpark account has been suspended by an administrator.${
      reason ? `\n\nReason: ${reason}` : ""
    }\n\nIf you believe this was a mistake, please contact support.`,
    html: layout(
      "Account suspended",
      `<p>Hi ${esc(name)},</p>
       <p>Your EduSpark account has been <strong style="color:#f87171">suspended</strong> by an administrator.</p>
       ${
         reason
           ? `<p style="background:#1e293b;padding:12px;border-radius:8px;border-left:3px solid #f87171"><strong>Reason:</strong> ${esc(reason)}</p>`
           : ""
       }
       <p>If you believe this was a mistake, please contact support.</p>`
    ),
  };
}

export function accountReactivatedEmail(to: string, name: string): MailMessage {
  return {
    to,
    subject: "Your EduSpark account has been reactivated",
    text: `Hi ${name},\n\nGood news — your EduSpark account has been reactivated.\n\nSign in again: ${appUrl()}/auth/login`,
    html: layout(
      "Account reactivated",
      `<p>Hi ${esc(name)},</p>
       <p>Good news — your EduSpark account has been <strong style="color:#34d399">reactivated</strong>.</p>
       <p>You can now sign in and continue using the platform.</p>`,
      `${appUrl()}/auth/login`,
      "Sign in"
    ),
  };
}

export function roleChangedEmail(
  to: string,
  name: string,
  oldRole: string,
  newRole: string
): MailMessage {
  const oldLabel = ROLE_LABELS[oldRole] ?? oldRole;
  const newLabel = ROLE_LABELS[newRole] ?? newRole;
  return {
    to,
    subject: `Your EduSpark role was updated to ${newLabel}`,
    text: `Hi ${name},\n\nYour role on EduSpark has been changed from ${oldLabel} to ${newLabel} by an administrator.`,
    html: layout(
      "Your role was updated",
      `<p>Hi ${esc(name)},</p>
       <p>Your role on EduSpark has been changed by an administrator:</p>
       <p style="font-size:16px;text-align:center;padding:16px;background:#1e293b;border-radius:8px;margin:20px 0">
         <span style="color:#94a3b8">${esc(oldLabel)}</span>
         <span style="color:#818cf8;margin:0 8px">→</span>
         <strong style="color:#f1f5f9">${esc(newLabel)}</strong>
       </p>`,
      appUrl(),
      "Open EduSpark"
    ),
  };
}

export function courseArchivedEmail(
  to: string,
  name: string,
  courseTitle: string,
  reason?: string
): MailMessage {
  return {
    to,
    subject: `Your course "${courseTitle}" has been archived`,
    text: `Hi ${name},\n\nYour course "${courseTitle}" has been archived by an administrator and is no longer visible to students.${
      reason ? `\n\nReason: ${reason}` : ""
    }`,
    html: layout(
      "Course archived",
      `<p>Hi ${esc(name)},</p>
       <p>Your course <strong>"${esc(courseTitle)}"</strong> has been archived by an administrator and is no longer visible to students.</p>
       ${
         reason
           ? `<p style="background:#1e293b;padding:12px;border-radius:8px;border-left:3px solid #f59e0b"><strong>Reason:</strong> ${esc(reason)}</p>`
           : ""
       }
       <p>If you have questions, please contact support.</p>`,
      `${appUrl()}/dashboard/creator/courses`,
      "View my courses"
    ),
  };
}

export function serviceArchivedEmail(
  to: string,
  name: string,
  serviceTitle: string,
  reason?: string
): MailMessage {
  return {
    to,
    subject: `Your service "${serviceTitle}" has been archived`,
    text: `Hi ${name},\n\nYour service "${serviceTitle}" has been archived by an administrator and is no longer visible in the marketplace.${
      reason ? `\n\nReason: ${reason}` : ""
    }`,
    html: layout(
      "Service archived",
      `<p>Hi ${esc(name)},</p>
       <p>Your service <strong>"${esc(serviceTitle)}"</strong> has been archived by an administrator and is no longer visible in the marketplace.</p>
       ${
         reason
           ? `<p style="background:#1e293b;padding:12px;border-radius:8px;border-left:3px solid #f59e0b"><strong>Reason:</strong> ${esc(reason)}</p>`
           : ""
       }
       <p>If you have questions, please contact support.</p>`,
      `${appUrl()}/dashboard/creator/services`,
      "View my services"
    ),
  };
}
