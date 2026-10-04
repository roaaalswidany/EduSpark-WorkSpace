import { config } from "dotenv";
import { resolve } from "path";

// Load Next.js local env for Prisma CLI
config({ path: resolve(process.cwd(), ".env.local") });

import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});