import { NextResponse } from "next/server";
import { getPublicCertificate } from "@/lib/certificates/public";
import { checkRateLimit, getClientIdentifier, RateLimits } from "@/lib/security/rate-limit";

/**
 * Machine-readable verification for employers / third-party systems.
 *   200 { valid: true, certificate: {...} }   404 { valid: false }   429 rate limited
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ credentialId: string }> }
) {
  const limit = await checkRateLimit(
    RateLimits.PUBLIC_VERIFY,
    `api:${getClientIdentifier(req.headers)}`
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const { credentialId } = await ctx.params;
  const cert = await getPublicCertificate(credentialId);
  if (!cert) {
    return NextResponse.json({ valid: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { valid: true, certificate: { ...cert, issuedAt: cert.issuedAt.toISOString() } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
