import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { ensureBaseData, ensureAdmin } from "@/lib/bootstrap/ensure-base-data";
import { BADGE_CATALOG } from "@/lib/gamification/badges";
import { CATEGORIES } from "@/prisma/seed/categories";
import { resetDatabase, createUser } from "./helpers/factories";
import bcrypt from "bcryptjs";

beforeEach(resetDatabase);
const ENV = { email: "Admin@Example.com", password: "a-very-long-secret-1", name: "Root" };

describe("production bootstrap (idempotent)", () => {
  it("creates badges, categories and the first admin on an empty database", async () => {
    const r = await ensureBaseData(db, ENV);
    expect(r).toEqual({ badges: BADGE_CATALOG.length, categories: CATEGORIES.length, admin: "created" });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    expect(admin.role).toBe("ADMIN");
    expect(admin.emailVerified).not.toBeNull();
    expect(await bcrypt.compare(ENV.password, admin.password!)).toBe(true);
  });

  it("running it again changes nothing and never duplicates", async () => {
    await ensureBaseData(db, ENV);
    const r2 = await ensureBaseData(db, ENV);
    expect(r2.admin).toBe("exists");
    expect(await db.badge.count()).toBe(BADGE_CATALOG.length);
    expect(await db.category.count()).toBe(CATEGORIES.length);
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });

  it("does NOT wipe earned badges when re-run (unlike the demo seed)", async () => {
    await ensureBaseData(db, ENV);
    const u = await createUser();
    const badge = await db.badge.findFirstOrThrow();
    await db.userBadge.create({ data: { userId: u.id, badgeId: badge.id } });
    await ensureBaseData(db, ENV);
    expect(await db.userBadge.count({ where: { userId: u.id } })).toBe(1);
  });

  it("refuses a weak admin password, skips when no credentials, never promotes an existing user", async () => {
    await expect(ensureAdmin(db, { email: "a@b.co", password: "short" })).rejects.toThrow(/12 characters/);
    expect(await ensureAdmin(db, {})).toBe("skipped");
    await createUser("STUDENT", { email: "admin@example.com" });
    expect(await ensureAdmin(db, ENV)).toBe("skipped");
    expect((await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } })).role).toBe("STUDENT");
  });
});
