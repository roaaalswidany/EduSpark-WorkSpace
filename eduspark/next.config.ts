import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname, ".."),
    
  },
    serverExternalPackages: ["@prisma/client", "prisma"],
  // ... باقي الإعدادات
};

export default nextConfig;