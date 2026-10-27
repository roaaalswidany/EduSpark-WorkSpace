import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  // Single source of truth: the web app owns the schema. A second copy drifted
  // and (with hoisted node_modules) overwrote the web app's generated client.
  schema: "../eduspark/prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});