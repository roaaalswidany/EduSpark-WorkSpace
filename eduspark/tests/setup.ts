import { vi, beforeEach } from "vitest";
import Redis from "ioredis";

// ── Next.js runtime shims (server actions import these) ─────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.7" })),
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
}));

// ── next-auth: getServerSession is driven by tests/helpers/session.ts ───────
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(() => vi.fn()),
}));

// The chat server is not running in tests; real-time emits must be no-ops.
vi.mock("@/lib/notifications/emit", () => ({
  emitNotification: vi.fn(async () => undefined),
}));

// Capture outgoing email instead of sending it (see tests/helpers/mail.ts).
vi.mock("@/lib/email/mailer", () => ({
  sendMail: vi.fn(async (m: unknown) => {
    ((globalThis as { __mails?: unknown[] }).__mails ??= []).push(m);
    return true;
  }),
}));

// ── Safety rails: these tests TRUNCATE every table and FLUSH the Redis db. ──────
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL is not set. Point it at a THROWAWAY database (name must contain 'test').");
}
const dbName = decodeURIComponent(new URL(dbUrl).pathname.replace(/^\//, ""));
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run: database "${dbName}" does not look like a test database. ` +
      "The suite wipes all tables — use a database whose name contains 'test' (e.g. eduspark_test)."
  );
}
if (process.env.REDIS_URL) {
  const redisDb = Number(new URL(process.env.REDIS_URL).pathname.replace(/^\//, "") || "0");
  if (!(redisDb >= 1)) {
    throw new Error("Refusing to run: REDIS_URL must select a non-default db (e.g. redis://localhost:6379/1) because the suite FLUSHES it.");
  }
}

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

beforeEach(async () => {
  // Rate-limit counters must not leak between tests.
  if (redis) await redis.flushdb();
});
