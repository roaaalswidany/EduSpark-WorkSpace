import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),

  REDIS_URL: z.string().url("REDIS_URL must be a valid Redis URL"),

  REDIS_PASSWORD: z.string().optional(),

  NEXTJS_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  // ─── Internal API (server-to-server from Next.js) ─────────────────────────
  INTERNAL_API_SECRET: z
    .string()
    .min(16, "INTERNAL_API_SECRET must be at least 16 characters"),

  // Rate limiting
  MAX_MESSAGES_PER_MINUTE: z.coerce.number().int().min(1).max(500).default(60),
  MAX_CONNECTIONS_PER_USER: z.coerce.number().int().min(1).max(10).default(5),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    result.error.issues.forEach((issue) => {
      console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;