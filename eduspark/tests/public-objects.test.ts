import { describe, it, expect, afterEach, vi } from "vitest";
import { publicObjectUrl, keyFromPublicUrl, PUBLIC_PREFIX } from "@/lib/storage/public-objects";

const KEY = `${PUBLIC_PREFIX}courses/abc/thumbnail-1.png`;

function config(url: string, bucket = "eduspark-uploads") {
  vi.stubEnv("S3_PUBLIC_URL", url);
  vi.stubEnv("S3_PUBLIC_BUCKET", bucket);
}
afterEach(() => vi.unstubAllEnvs());

describe("public object URLs", () => {
  it("S3_PUBLIC_URL without the bucket → <url>/<bucket>/<key>", () => {
    config("http://localhost:9000");
    expect(publicObjectUrl(KEY)).toBe(`http://localhost:9000/eduspark-uploads/${KEY}`);
  });

  it("a trailing slash is ignored", () => {
    config("http://localhost:9000/");
    expect(publicObjectUrl(KEY)).toBe(`http://localhost:9000/eduspark-uploads/${KEY}`);
  });

  it("S3_PUBLIC_URL that ALREADY contains the bucket is not doubled (…/bucket/bucket/… 404 bug)", () => {
    config("http://localhost:9000/eduspark-uploads");
    expect(publicObjectUrl(KEY)).toBe(`http://localhost:9000/eduspark-uploads/${KEY}`);
    config("http://localhost:9000/eduspark-uploads/");
    expect(publicObjectUrl(KEY)).toBe(`http://localhost:9000/eduspark-uploads/${KEY}`);
  });

  it("a bucket name that merely appears elsewhere in the URL is still appended", () => {
    config("https://eduspark-uploads.cdn.example.com", "eduspark-uploads");
    expect(publicObjectUrl(KEY)).toBe(`https://eduspark-uploads.cdn.example.com/eduspark-uploads/${KEY}`);
  });

  it("keyFromPublicUrl is the exact inverse, in both configurations", () => {
    for (const base of ["http://localhost:9000", "http://localhost:9000/eduspark-uploads"]) {
      config(base);
      expect(keyFromPublicUrl(publicObjectUrl(KEY))).toBe(KEY);
    }
  });

  it("URLs from another host, external images and path traversal are never treated as ours", () => {
    config("http://localhost:9000");
    expect(keyFromPublicUrl("https://images.unsplash.com/photo-1")).toBeNull();
    expect(keyFromPublicUrl("http://evil.example/eduspark-uploads/" + KEY)).toBeNull();
    expect(keyFromPublicUrl(`http://localhost:9000/eduspark-uploads/${PUBLIC_PREFIX}../secret`)).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
    expect(keyFromPublicUrl("")).toBeNull();
  });
});
