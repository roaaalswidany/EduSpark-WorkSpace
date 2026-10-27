import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { assertSeedAllowed } from "@/prisma/seed/guard";
import { cleanupAll } from "@/prisma/seed/cleanup";
import { PROTECTED_EMAILS, DEMO_EMAIL_DOMAIN } from "@/prisma/seed/config";
import { ensureAdmin, promoteToAdmin } from "@/lib/bootstrap/ensure-base-data";
import { resetDatabase, createUser } from "./helpers/factories";

const LOCAL = "postgresql://u:p@localhost:5432/eduspark";

describe("assertSeedAllowed — the demo seed can never hit production or a remote database by accident", () => {
  it("allows local development hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "postgres", "db"])
      expect(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: `postgresql://u:p@${host}:5432/x` })).not.toThrow();
  });
  it("refuses NODE_ENV=production unless explicitly overridden", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: LOCAL })).toThrow(/production/);
    expect(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: LOCAL, ALLOW_SEED_IN_PRODUCTION: "true" })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: "production", DATABASE_URL: LOCAL, ALLOW_SEED_IN_PRODUCTION: "yes" })).toThrow(); // only the exact word
  });
  it("refuses any non-local host (cloud / VPS databases) unless explicitly overridden", () => {
    for (const host of ["db.abcd.supabase.co", "ep-cool-123.neon.tech", "10.0.0.5", "prod-db.example.com"]) {
      const env = { NODE_ENV: "development", DATABASE_URL: `postgresql://u:p@${host}:5432/x` };
      expect(() => assertSeedAllowed(env)).toThrow(/non-local/);
      expect(() => assertSeedAllowed({ ...env, ALLOW_SEED_REMOTE: "true" })).not.toThrow();
    }
  });
  it("fails closed on a missing or malformed DATABASE_URL", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development" })).toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "not a url" })).toThrow();
  });
  it("a hostname that merely CONTAINS 'localhost' is not treated as local", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "postgresql://u:p@localhost.evil.com:5432/x" })).toThrow(/non-local/);
  });
});

describe("seed cleanup never deletes a real account", () => {
  beforeEach(resetDatabase);
  it("removes @eduspark.dev demo users but keeps every other user (and their account)", async () => {
    const real = await createUser("ADMIN", { email: "real.person@gmail.com" });
    const real2 = await createUser("STUDENT", { email: "someone@university.edu" });
    const demo = await createUser("STUDENT", { email: `demo.user${DEMO_EMAIL_DOMAIN}` });
    await cleanupAll(db);
    expect(await db.user.findUnique({ where: { id: real.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: real2.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: demo.id } })).toBeNull();
  });
  it("PROTECTED_EMAILS is empty by default (no personal data in the repository)", () => {
    expect(PROTECTED_EMAILS).toEqual([]);
  });
});

describe("setup-admin building blocks", () => {
  beforeEach(resetDatabase);
  it("promoteToAdmin: promotes an existing user, is idempotent, never creates users", async () => {
    await createUser("STUDENT", { email: "promote.me@test.local" });
    expect(await promoteToAdmin(db, " Promote.Me@test.local ")).toBe("promoted");
    expect(await promoteToAdmin(db, "promote.me@test.local")).toBe("already-admin");
    expect(await promoteToAdmin(db, "ghost@test.local")).toBe("not-found");
    expect(await db.user.count()).toBe(1);
  });
  it("ensureAdmin rejects the old public demo password and any short password", async () => {
    for (const pw of ["Password123!", "PASSWORD123!", "short", "eduspark1234", "alexander-admin-1"])
      await expect(ensureAdmin(db, { email: "alexander@x.co", password: pw })).rejects.toThrow(/well-known|12 characters/);
    expect(await db.user.count()).toBe(0);
    expect(await ensureAdmin(db, { email: "alexander@x.co", password: "Zk9#vQ2!mXp7Lr" })).toBe("created");
  });
});

/** Fails the build if someone re-introduces credentials / personal data into the PUBLIC repository. */
describe("repository hygiene (public repo)", () => {
  const root = join(__dirname, "..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (/node_modules|\.next|\.git$/.test(p)) return [];
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|md|json|yml|yaml)$/.test(n) ? [p] : [];
    });
  const files = ["scripts", "actions", "lib", "app", "components", "prisma"].flatMap((d) => walk(join(root, d)));

  it("no real personal email addresses in source (only @eduspark.dev / @test.local / example domains)", () => {
    const bad = files.filter((f) => /[\w.+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.com/i.test(readFileSync(f, "utf8")));
    expect(bad.map((f) => f.replace(root, ""))).toEqual([]);
  });
  it("the demo password literal exists ONLY in prisma/seed/config.ts (dev default, guarded)", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("Password123!")).map((f) => f.replace(root, ""));
    expect(hits.every((h) => h.endsWith("prisma/seed/config.ts") || h.endsWith("seed.ts") === false)).toBe(true);
    expect(hits.filter((h) => !h.endsWith("prisma/seed/config.ts"))).toEqual([]);
  });
  it("no key-shaped secrets in source", () => {
    const re = /AIza[0-9A-Za-z_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY/;
    expect(files.filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => f.replace(root, ""))).toEqual([]);
  });
  it("no manual backup files are tracked", () => {
    expect(walk(root).filter((f) => /\.(backup|bak)$/.test(f))).toEqual([]);
  });
});
