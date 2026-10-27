import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { awardXP } from "@/lib/gamification/award";
import { nextStreak } from "@/lib/gamification/streak";
import { ensureBadges } from "@/lib/bootstrap/ensure-base-data";
import { resetDatabase, createUser } from "./helpers/factories";

const d = (iso: string) => new Date(iso + "T12:00:00Z");

describe("nextStreak (pure)", () => {
  it("starts at 1, keeps same-day, +1 next day, resets after a gap, tracks the best", () => {
    let s = nextStreak(null, d("2026-10-01"));
    expect(s).toMatchObject({ currentStreak: 1, longestStreak: 1 });
    s = nextStreak(s, d("2026-10-01")); expect(s.currentStreak).toBe(1);
    s = nextStreak(s, d("2026-10-02")); expect(s.currentStreak).toBe(2);
    s = nextStreak(s, d("2026-10-03")); expect(s.currentStreak).toBe(3);
    s = nextStreak(s, d("2026-10-06")); expect(s).toMatchObject({ currentStreak: 1, longestStreak: 3 });
  });
  it("is robust to the UTC midnight boundary", () => {
    const s = nextStreak({ currentStreak: 4, longestStreak: 4, lastActiveDate: new Date("2026-10-01T23:59:59Z") }, new Date("2026-10-02T00:00:01Z"));
    expect(s.currentStreak).toBe(5);
  });
});

describe("F3 — streak is actually persisted, and the 7-day badge becomes earnable", () => {
  beforeAll(async () => { await resetDatabase(); await ensureBadges(db); });
  it("awarding XP updates currentStreak; a 6-day streak + today earns the 7-day badge", async () => {
    const u = await createUser();
    await awardXP(u.id, "LESSON_COMPLETED");
    expect((await db.userStats.findUniqueOrThrow({ where: { userId: u.id } })).currentStreak).toBe(1);

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    await db.userStats.update({ where: { userId: u.id }, data: { currentStreak: 6, longestStreak: 6, lastActiveDate: yesterday } });
    await awardXP(u.id, "LESSON_COMPLETED");
    const s = await db.userStats.findUniqueOrThrow({ where: { userId: u.id } });
    expect(s.currentStreak).toBe(7);
    const badges = await db.userBadge.findMany({ where: { userId: u.id }, include: { badge: true } });
    expect(badges.map((b) => b.badge.key)).toContain("week_streak");
  });
});
