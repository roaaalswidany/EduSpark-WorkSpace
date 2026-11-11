import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { updateStepStatusAction } from "@/actions/career-path/update-step-status";
import { getServerSession } from "next-auth";

// ✅ Mock كامل — يشمل getServerSession + default
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
  })),
}));

describe("career path step status — integrity", () => {
  let userId: string;
  let pathId: string;
  let stepId: string;

  beforeEach(async () => {
    // Unique user per test to avoid cross-test pollution
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const user = await db.user.create({
      data: {
        email: `cptest-${stamp}@test.local`,
        name: "CP Test User",
        role: "STUDENT",
        isActive: true,
        emailVerified: new Date(),
        password: "hashed-irrelevant",
      },
    });
    userId = user.id;

    // ✅ All required fields provided
    const path = await db.careerPath.create({
      data: {
        userId,
        goal: "Become a full-stack developer",
        level: "BEGINNER",
        estimatedWeeks: 12,
        status: "ACTIVE",
        steps: {
          create: {
            title: "Learn HTML",
            description: "Master the basics of HTML5",
            estimatedWeeks: 2,
            skills: ["html", "css"],
            order: 1,
            status: "PENDING",
          },
        },
      },
      include: { steps: true },
    });
    pathId = path.id;
    stepId = path.steps[0].id;

    // Mock session for this test
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: userId, email: "test@test.local", role: "STUDENT" },
    } as never);
  });

  it("transitions PENDING → IN_PROGRESS → COMPLETED successfully", async () => {
    const r1 = await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.statusChanged).toBe(true);

    const r2 = await updateStepStatusAction({ stepId, status: "COMPLETED" });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.statusChanged).toBe(true);

    const final = await db.careerPathStep.findUnique({
      where: { id: stepId },
      select: { status: true },
    });
    expect(final?.status).toBe("COMPLETED");
  });

  it("idempotent: same status = no change, no XP", async () => {
    await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
    const r = await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });

    expect(r.success).toBe(true);
    if (r.success) expect(r.statusChanged).toBe(false);
  });

  it("rejects backwards transition COMPLETED → PENDING", async () => {
    await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
    await updateStepStatusAction({ stepId, status: "COMPLETED" });

    const r = await updateStepStatusAction({ stepId, status: "PENDING" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("INVALID_TRANSITION");
  });

  it("rejects IN_PROGRESS → PENDING, so start/pause cycling cannot farm STEP_STARTED XP", async () => {
    expect((await updateStepStatusAction({ stepId, status: "IN_PROGRESS" })).success).toBe(true);
    const xpAfterStart = (await db.userStats.findUnique({ where: { userId } }))?.xp ?? 0;
    expect(xpAfterStart).toBeGreaterThan(0);

    for (let i = 0; i < 3; i++) {
      const back = await updateStepStatusAction({ stepId, status: "PENDING" });
      expect(back.success).toBe(false);
      if (!back.success) expect(back.error).toBe("INVALID_TRANSITION");
      const again = await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
      expect(again.success).toBe(true);
      if (again.success) expect(again.statusChanged).toBe(false); // already IN_PROGRESS
    }

    expect((await db.userStats.findUnique({ where: { userId } }))?.xp).toBe(xpAfterStart);
    expect((await db.careerPathStep.findUnique({ where: { id: stepId } }))?.status).toBe("IN_PROGRESS");
  });

  it("awards each step's XP exactly once over its whole life (start, then completion)", async () => {
    await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
    const started = (await db.userStats.findUnique({ where: { userId } }))?.xp ?? 0;
    await updateStepStatusAction({ stepId, status: "COMPLETED" });
    const completed = (await db.userStats.findUnique({ where: { userId } }))?.xp ?? 0;
    expect(completed).toBeGreaterThan(started);

    // Nothing can be repeated or undone afterwards: no more XP.
    for (const status of ["IN_PROGRESS", "COMPLETED", "PENDING"] as const) {
      await updateStepStatusAction({ stepId, status });
    }
    expect((await db.userStats.findUnique({ where: { userId } }))?.xp).toBe(completed);
  });

  it("rejects PENDING → COMPLETED (must go through IN_PROGRESS)", async () => {
    const r = await updateStepStatusAction({ stepId, status: "COMPLETED" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("INVALID_TRANSITION");
  });

  it("only ONE of 8 concurrent transitions succeeds (no double XP)", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        updateStepStatusAction({ stepId, status: "IN_PROGRESS" })
      )
    );

    const changed = results.filter((r) => r.success && r.statusChanged);
    expect(changed).toHaveLength(1);

    const final = await db.careerPathStep.findUnique({
      where: { id: stepId },
      select: { status: true },
    });
    expect(final?.status).toBe("IN_PROGRESS");
  });

  it("forbids updating another user's step", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "different-user-id",
        email: "other@test.local",
        role: "STUDENT",
      },
    } as never);

    const r = await updateStepStatusAction({ stepId, status: "IN_PROGRESS" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("FORBIDDEN");
  });
});