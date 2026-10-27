/**
 * When REQUIRE_EMAIL_VERIFICATION=true, accounts must confirm their email
 * before ordering services, earning certificates or publishing services.
 * Off by default so existing/demo accounts keep working.
 */
export const isEmailVerificationRequired = () =>
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";

export const emailVerificationOk = (u: { emailVerified: Date | null }) =>
  !isEmailVerificationRequired() || u.emailVerified !== null;
