import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? [
            { level: "query", emit: "event" },
            { level: "error", emit: "stdout" },
            { level: "warn", emit: "stdout" },
          ]
        : [{ level: "error", emit: "stdout" }],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// تسجيل الاستعلامات البطيئة في وضع التطوير
if (env.NODE_ENV === "development") {
  // @ts-expect-error — حدث query متاح فقط في dev mode
  prisma.$on("query", (e: { query: string; duration: number }) => {
    if (e.duration > 200) {
      console.warn(`⚠️ Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}