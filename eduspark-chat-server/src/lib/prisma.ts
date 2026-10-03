import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

declare global {
  var __prismaChatServer: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
      ...(process.env.NODE_ENV === "development"
        ? [{ level: "query" as const, emit: "event" as const }]
        : []),
    ],
  });

  client.$on("error", (e) => {
    logger.error("Prisma error", { meta: { message: e.message, target: e.target } });
  });

  client.$on("warn", (e) => {
    logger.warn("Prisma warning", { meta: { message: e.message, target: e.target } });
  });

  if (process.env.NODE_ENV === "development") {
    client.$on("query", (e: { query: string; duration: number }) => {
      if (e.duration > 500) {
        logger.warn("Slow Prisma query", { meta: { duration: e.duration, query: e.query } });
      }
    });
  }

  return client;
}

export const prisma: PrismaClient =
  globalThis.__prismaChatServer ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaChatServer = prisma;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database health check failed", {
      meta: { error: error instanceof Error ? error.message : String(error) },
    });
    return false;
  }
}