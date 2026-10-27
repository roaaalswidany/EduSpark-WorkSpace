import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

export type TokenPurpose = "verify-email" | "reset-password";

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const identifier = (purpose: TokenPurpose, email: string) =>
  `${purpose}:${email.trim().toLowerCase()}`;

/**
 * Issues a single-use token. Only its SHA-256 is stored, so a database leak
 * does not yield usable links. Re-issuing invalidates the previous token.
 */
export async function issueEmailToken(
  purpose: TokenPurpose,
  email: string,
  ttlMinutes: number
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const id = identifier(purpose, email);
  await db.$transaction([
    db.verificationToken.deleteMany({
      where: { OR: [{ identifier: id }, { expires: { lt: new Date() } }] },
    }),
    db.verificationToken.create({
      data: { identifier: id, token: hash(raw), expires: new Date(Date.now() + ttlMinutes * 60_000) },
    }),
  ]);
  return raw;
}

/** Atomically consumes a token. true = valid and now spent; false otherwise. */
export async function consumeEmailToken(
  purpose: TokenPurpose,
  email: string,
  raw: string
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(raw)) return false;
  const res = await db.verificationToken.deleteMany({
    where: {
      identifier: identifier(purpose, email),
      token: hash(raw),
      expires: { gt: new Date() },
    },
  });
  return res.count === 1;
}
