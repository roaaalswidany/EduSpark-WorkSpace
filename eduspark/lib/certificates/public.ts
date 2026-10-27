import { db } from "@/lib/db";

/** EDU-<base36 timestamp>-<48-bit random hex> — see generateCredentialId(). */
export const CREDENTIAL_ID_RE = /^EDU-[0-9A-Z]{6,12}-[0-9A-F]{12}$/;

/** Everything a third party may learn from a credential ID — nothing more. */
export interface PublicCertificate {
  credentialId: string;
  holderName: string;
  courseTitle: string;
  categoryName: string | null;
  score: number;
  issuedAt: Date;
  issuer: "EduSpark";
}

export async function getPublicCertificate(
  rawCredentialId: string
): Promise<PublicCertificate | null> {
  const credentialId = rawCredentialId.trim().toUpperCase();
  if (!CREDENTIAL_ID_RE.test(credentialId)) return null; // never hit the DB with junk

  const c = await db.certificate.findUnique({
    where: { credentialId },
    select: {
      credentialId: true,
      score: true,
      issuedAt: true,
      user: { select: { name: true } },
      course: { select: { title: true, category: { select: { name: true } } } },
    },
  });
  if (!c) return null;

  return {
    credentialId: c.credentialId,
    holderName: c.user.name,
    courseTitle: c.course.title,
    categoryName: c.course.category?.name ?? null,
    score: Math.round(c.score),
    issuedAt: c.issuedAt,
    issuer: "EduSpark",
  };
}
