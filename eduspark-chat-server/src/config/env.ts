import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(3001),

  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "debug"])
    .default("info"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security."),

  NEXT_APP_URL: z
    .string()
    .url("NEXT_APP_URL must be a valid URL."),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required."),

  MAX_MESSAGES_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(300)
    .default(30),

  MAX_CONNECTIONS_PER_IP: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),

  AUDIT_LOG_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(90),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(formatted, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;