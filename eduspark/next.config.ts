import type { NextConfig } from "next";
import { resolve } from "path";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

// Where course thumbnails are served from: S3_PUBLIC_URL (production) or local MinIO (development only).
type RemotePatterns = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>;

function storageImagePatterns(): RemotePatterns {
  const patterns: RemotePatterns = [];
  const raw = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;
  if (raw) {
    try {
      const u = new URL(raw);
      patterns.push({
        protocol: u.protocol === "https:" ? "https" : "http",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
      });
    } catch {
      /* ignore a malformed URL: the image host simply is not whitelisted */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    patterns.push({ protocol: "http", hostname: "localhost", port: "9000" });
    patterns.push({ protocol: "http", hostname: "127.0.0.1", port: "9000" });
  }
  return patterns;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname, ".."),
  },
  serverExternalPackages: ["@prisma/client", "prisma"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      ...storageImagePatterns(),
    ],
  },
  staticPageGenerationTimeout: 120,
  
  // Server Actions body limit (global). Thumbnails are capped at 2MB, so 3MB leaves room for the form overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;