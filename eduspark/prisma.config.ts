import { config } from "dotenv";
import { resolve } from "path";

// Chooses which env file Prisma CLI loads. Defaults to .env.local.
// Set PRISMA_ENV_FILE=.env.test to run migrations/seeds against the test DB.
const envFile = process.env.PRISMA_ENV_FILE || ".env.local";
console.log("🔍 Prisma is reading:", envFile, "=>", resolve(process.cwd(), envFile));
config({ path: resolve(process.cwd(), envFile) });

import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});