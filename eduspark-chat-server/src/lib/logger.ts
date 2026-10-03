import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

// ─── Log directory bootstrap ──────────────────────────────────────────────────

const LOG_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Sensitive field redaction ────────────────────────────────────────────────
// Strip any sensitive keys before writing to transports.

const REDACT_KEYS = new Set([
  "token",
  "authorization",
  "password",
  "secret",
  "cookie",
  "jwt",
  "accessToken",
  "refreshToken",
]);

function deepRedact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((v) => deepRedact(v, depth + 1));
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(obj)) {
    result[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : deepRedact(v, depth + 1);
  }

  return result;
}

// ─── Formats ──────────────────────────────────────────────────────────────────

const redactTransform = winston.format((info) => {
  if (info["meta"] !== undefined) {
    info["meta"] = deepRedact(info["meta"]);
  }
  return info;
});

const fileFormat = winston.format.combine(
  redactTransform(),
  winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const cleanMeta = deepRedact(meta);
    const metaStr =
      Object.keys(cleanMeta as object).length > 0
        ? `\n  ${JSON.stringify(cleanMeta, null, 2).replace(/\n/g, "\n  ")}`
        : "";
    return `${timestamp} ${level}: ${String(message)}${metaStr}`;
  })
);

// ─── Main Logger ──────────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "eduspark-chat" },
  transports: [
    // Console — always enabled
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    }),

    // Error-only — long retention
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "30d",
      maxSize: "20m",
      format: fileFormat,
      handleExceptions: true,
    }),

    // Combined — standard operational logs
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "50m",
      format: fileFormat,
    }),
  ],
  exitOnError: false,
});

// ─── Audit Logger ─────────────────────────────────────────────────────────────
// Separate logger for the legally-required message audit trail.
// Stores raw content with sender/room metadata for compliance.
// Retention period configurable via env.AUDIT_LOG_RETENTION_DAYS.

export const auditLogger = winston.createLogger({
  level: "info",
  defaultMeta: { service: "eduspark-chat-audit" },
  transports: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "audit-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: `${env.AUDIT_LOG_RETENTION_DAYS}d`,
      maxSize: "100m",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
        winston.format.json()
      ),
    }),
  ],
  exitOnError: false,
});

// ─── Security Logger ──────────────────────────────────────────────────────────
// Dedicated stream for authentication failures, rate limit violations,
// and other security events — kept separately for SIEM integration.

export const securityLogger = winston.createLogger({
  level: "warn",
  defaultMeta: { service: "eduspark-chat-security" },
  transports: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "security-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "90d",
      maxSize: "20m",
      format: fileFormat,
    }),
    // Mirror security events to console in all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} 🔒 ${level}: ${String(message)} ${JSON.stringify(meta)}`
        )
      ),
    }),
  ],
  exitOnError: false,
});

// ─── Request stream for Morgan-compatible HTTP logging ────────────────────────

export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trimEnd());
  },
};

logger.info("Logger initialised", {
  meta: {
    logDir: LOG_DIR,
    level: env.LOG_LEVEL,
    auditRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
  },
});