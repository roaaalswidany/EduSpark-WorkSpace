// eduspark/lib/storage/public-objects.ts
//
// Public objects (course thumbnails) live under the `public/` prefix ONLY.
// The bucket policy (scripts/apply-storage-policy.ts) makes just that prefix anonymously readable,
// so private attachments (milestones, chat, lessons) in the same bucket are never exposed.
//
// Env (all optional, sensible fallbacks):
//   S3_PUBLIC_URL     public base URL browsers use to read objects (e.g. https://cdn.example.com).
//                     Defaults to S3_ENDPOINT — fine locally, WRONG in production when S3_ENDPOINT is
//                     an internal hostname such as http://minio:9000.
//   S3_PUBLIC_BUCKET  bucket that holds public objects. Defaults to S3_BUCKET_NAME.
//
// Pure module (no AWS client import) so it can be unit-tested.

export const PUBLIC_PREFIX = "public/";

function stripSlashes(s: string) {
  return s.replace(/\/+$/, "");
}

export function publicBaseUrl(): string {
  return stripSlashes(process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "");
}

export function publicBucket(): string {
  return process.env.S3_PUBLIC_BUCKET || process.env.S3_BUCKET_NAME || "";
}

export function thumbnailKey(courseId: string, uuid: string, ext: string): string {
  return `${PUBLIC_PREFIX}courses/${courseId}/thumbnail-${uuid}.${ext}`;
}

/** Path-style URL (what MinIO and most S3-compatible servers expect). */
export function publicObjectUrl(key: string): string {
  return `${publicBaseUrl()}/${publicBucket()}/${key}`;
}

/** Inverse of publicObjectUrl; null when the URL does not point into our storage. */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${publicBaseUrl()}/${publicBucket()}/`;
  if (!prefix.startsWith("http") || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 && !key.includes("..") ? key : null;
}

export interface ImageKind {
  mime: "image/png" | "image/jpeg" | "image/webp";
  ext: "png" | "jpg" | "webp";
}

/**
 * Identify an image by its first bytes (magic numbers). The browser-declared MIME type and the
 * file name are attacker-controlled; the content is not.
 */
export function sniffImage(buf: Uint8Array): ImageKind | null {
  if (buf.length < 12) return null;
  const startsWith = (sig: number[], at = 0) => sig.every((b, i) => buf[at + i] === b);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // WebP: "RIFF" <4 bytes size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
