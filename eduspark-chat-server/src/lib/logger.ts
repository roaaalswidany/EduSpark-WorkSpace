import { env } from "../config/env";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: "eduspark-chat";
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[env.LOG_LEVEL as LogLevel];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "eduspark-chat",
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("error")) writeLog(formatLog("error", message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("warn")) writeLog(formatLog("warn", message, meta));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("info")) writeLog(formatLog("info", message, meta));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("debug")) writeLog(formatLog("debug", message, meta));
  },
};