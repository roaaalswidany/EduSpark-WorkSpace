/** Canonical public origin: NEXTAUTH_URL when set, else the request headers. */
export function publicBaseUrl(h: Headers): string {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
