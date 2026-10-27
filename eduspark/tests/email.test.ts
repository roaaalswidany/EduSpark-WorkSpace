import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerAction } from "@/actions/auth/register";
import { requestPasswordResetAction, resetPasswordAction } from "@/actions/auth/password-reset";
import { verifyEmailAction, resendVerificationEmailAction } from "@/actions/auth/verify-email";
import { orderServiceAction } from "@/actions/projects/order-service";
import { resetDatabase, createUser, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";
import { outbox, clearOutbox, lastToken } from "./helpers/mail";

const PW = "Str0ng!Pass";
const NEW_PW = "N3w!Passw0rd";

beforeEach(async () => { await resetDatabase(); clearOutbox(); resetSession(); });

describe("email verification", () => {
  it("sign-up emails a link; confirming sets emailVerified; the token is single-use", async () => {
    const email = "ver@test.local";
    expect((await registerAction({ name: "Ver User", email, password: PW, confirmPassword: PW })).success).toBe(true);
    await new Promise((r) => setTimeout(r, 300)); // mail is fire-and-forget
    expect(outbox().filter((m) => m.to === email)).toHaveLength(1);
    const token = lastToken(email);

    // only a hash is stored
    const row = await db.verificationToken.findFirstOrThrow({ where: { identifier: `verify-email:${email}` } });
    expect(row.token).not.toBe(token);
    expect(row.token).toHaveLength(64);

    expect(await verifyEmailAction({ email, token: "0".repeat(64) })).toMatchObject({ success: false });
    expect((await verifyEmailAction({ email, token })).success).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).not.toBeNull();
    expect((await verifyEmailAction({ email, token })).success).toBe(false); // replay
  });

  it("a token cannot verify a DIFFERENT address", async () => {
    await registerAction({ name: "Aaa Aaa", email: "a@test.local", password: PW, confirmPassword: PW });
    await registerAction({ name: "Bbb Bbb", email: "b@test.local", password: PW, confirmPassword: PW });
    await new Promise((r) => setTimeout(r, 300));
    const tokenA = lastToken("a@test.local");
    expect((await verifyEmailAction({ email: "b@test.local", token: tokenA })).success).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { email: "b@test.local" } })).emailVerified).toBeNull();
  });

  it("resend works for the signed-in user and is rate-limited (3/hour)", async () => {
    const u = await createUser();
    actAs({ id: u.id, role: "STUDENT" });
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await resendVerificationEmailAction()).success);
    expect(results).toEqual([true, true, true, false, false]);
  });
});

describe("REQUIRE_EMAIL_VERIFICATION policy", () => {
  afterEach(() => { delete process.env.REQUIRE_EMAIL_VERIFICATION; });

  it("when enabled, an unverified account cannot order; a verified one can", async () => {
    const creator = await createUser("CREATOR");
    const cat = await createCategory();
    const svc = await db.service.create({ data: { title: "T", slug: `s-${Date.now()}`, description: "d", price: 5, deliveryDays: 2, creatorId: creator.id, categoryId: cat.id } });
    const client = await createUser("STUDENT");
    actAs({ id: client.id, role: "STUDENT" });
    const input = { serviceId: svc.id, requirements: "I need this delivered very soon please." };

    expect((await orderServiceAction(input)).success).toBe(true);  // flag off: allowed
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    expect(await orderServiceAction(input)).toMatchObject({ success: false, error: "EMAIL_NOT_VERIFIED" });
    await db.user.update({ where: { id: client.id }, data: { emailVerified: new Date() } });
    expect((await orderServiceAction(input)).success).toBe(true);
  });
});

describe("password reset", () => {
  const setup = async () => {
    const u = await createUser("STUDENT", { email: "reset@test.local", password: await bcrypt.hash(PW, 4) });
    clearOutbox();
    return u;
  };

  it("answers identically for unknown and known emails, but only mails real active accounts", async () => {
    await setup();
    expect(await requestPasswordResetAction("ghost@test.local")).toEqual({ success: true });
    expect(outbox()).toHaveLength(0);
    expect(await requestPasswordResetAction("reset@test.local")).toEqual({ success: true });
    expect(outbox()).toHaveLength(1);

    await db.user.update({ where: { email: "reset@test.local" }, data: { isActive: false } });
    clearOutbox();
    expect(await requestPasswordResetAction("reset@test.local")).toEqual({ success: true });
    expect(outbox()).toHaveLength(0);
  });

  it("full flow: new password works, old one doesn't, token is single-use, confirmation mail sent", async () => {
    const u = await setup();
    await requestPasswordResetAction("reset@test.local");
    const token = lastToken("reset@test.local");

    const ok = await resetPasswordAction({ email: "reset@test.local", token, password: NEW_PW, confirmPassword: NEW_PW });
    expect(ok.success).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await bcrypt.compare(NEW_PW, row.password!)).toBe(true);
    expect(await bcrypt.compare(PW, row.password!)).toBe(false);
    expect(row.emailVerified).not.toBeNull();
    await new Promise((r) => setTimeout(r, 200));
    expect(outbox().some((m) => /changed/i.test(m.subject))).toBe(true);

    const replay = await resetPasswordAction({ email: "reset@test.local", token, password: "An0ther!Pass", confirmPassword: "An0ther!Pass" });
    expect(replay.success).toBe(false);
  });

  it("5 concurrent attempts with the same token: exactly ONE wins", async () => {
    await setup();
    await requestPasswordResetAction("reset@test.local");
    const token = lastToken("reset@test.local");
    const res = await Promise.all(Array.from({ length: 5 }, () =>
      resetPasswordAction({ email: "reset@test.local", token, password: NEW_PW, confirmPassword: NEW_PW })));
    expect(res.filter((r) => r.success)).toHaveLength(1);
  });

  it("rejects: expired token, token for another email, weak password (token stays valid), mismatch", async () => {
    await setup();
    await createUser("STUDENT", { email: "other@test.local" });
    await requestPasswordResetAction("reset@test.local");
    const token = lastToken("reset@test.local");

    // weak password / mismatch must NOT burn the token
    expect((await resetPasswordAction({ email: "reset@test.local", token, password: "weak", confirmPassword: "weak" })).success).toBe(false);
    expect((await resetPasswordAction({ email: "reset@test.local", token, password: NEW_PW, confirmPassword: NEW_PW + "x" })).success).toBe(false);
    // token bound to its email
    expect((await resetPasswordAction({ email: "other@test.local", token, password: NEW_PW, confirmPassword: NEW_PW })).success).toBe(false);
    // expired
    await db.verificationToken.updateMany({ data: { expires: new Date(Date.now() - 1000) } });
    expect((await resetPasswordAction({ email: "reset@test.local", token, password: NEW_PW, confirmPassword: NEW_PW })).success).toBe(false);
  });

  it("rate-limits requests per target email (5/hour) so one address cannot be mail-bombed", async () => {
    await setup();
    const out = [];
    for (let i = 0; i < 7; i++) out.push((await requestPasswordResetAction("reset@test.local")).success);
    expect(out.filter(Boolean)).toHaveLength(5);
    expect(outbox().length).toBe(5);
  });

  it("re-requesting invalidates the previous link", async () => {
    await setup();
    await requestPasswordResetAction("reset@test.local");
    const first = lastToken("reset@test.local");
    await requestPasswordResetAction("reset@test.local");
    const second = lastToken("reset@test.local");
    expect(first).not.toBe(second);
    expect((await resetPasswordAction({ email: "reset@test.local", token: first, password: NEW_PW, confirmPassword: NEW_PW })).success).toBe(false);
    expect((await resetPasswordAction({ email: "reset@test.local", token: second, password: NEW_PW, confirmPassword: NEW_PW })).success).toBe(true);
  });
});
