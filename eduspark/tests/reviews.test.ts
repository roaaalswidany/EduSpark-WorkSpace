import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { orderServiceAction } from "@/actions/projects/order-service";
import { startMilestoneAction, requestMilestoneReviewAction, approveProjectCompletionAction } from "@/actions/projects/update-project";
import { createProjectReviewAction } from "@/actions/reviews/create-project-review";
import { getCreatorRating, getServiceRating, getCreatorCompletedProjects } from "@/lib/reviews/reputation";
import { resetDatabase, createUser, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

let creator: Awaited<ReturnType<typeof createUser>>;
let serviceId: string;

beforeAll(resetDatabase);
beforeEach(async () => {
  resetSession();
  await resetDatabase();
  creator = await createUser("CREATOR");
  const cat = await createCategory();
  serviceId = (await db.service.create({
    data: { title: "Logo", slug: `logo-${Date.now()}-${Math.random()}`, description: "d", price: 50, deliveryDays: 2, creatorId: creator.id, categoryId: cat.id },
  })).id;
});

/** Runs the real order → work → approval flow and returns the client and project. */
async function completedProject(opts: { complete?: boolean } = {}) {
  const client = await createUser("STUDENT");
  actAs({ id: client.id, role: "STUDENT" });
  const order = await orderServiceAction({ serviceId, requirements: "Please design a clean modern logo for me." });
  if (!order.success) throw new Error("order failed " + order.error);
  const ms = await db.milestone.findFirstOrThrow({ where: { projectId: order.projectId } });
  if (opts.complete !== false) {
    actAs({ id: creator.id, role: "CREATOR" });
    await startMilestoneAction(ms.id); await requestMilestoneReviewAction(ms.id);
    actAs({ id: client.id, role: "STUDENT" });
    await approveProjectCompletionAction(order.projectId);
  }
  return { client, projectId: order.projectId };
}

describe("creating a review", () => {
  it("the client of a COMPLETED project can review once; creator is notified; row is linked to creator + service", async () => {
    const { client, projectId } = await completedProject();
    actAs({ id: client.id, role: "STUDENT" });
    const res = await createProjectReviewAction({ projectId, rating: 5, comment: "  Excellent work!  " });
    expect(res.success).toBe(true);
    const row = await db.projectReview.findUniqueOrThrow({ where: { projectId } });
    expect(row).toMatchObject({ rating: 5, comment: "Excellent work!", reviewerId: client.id, creatorId: creator.id, serviceId });
    const notes = await db.notification.findMany({ where: { userId: creator.id, title: { contains: "review" } } });
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("5/5");
  });

  it("is refused for: creator, outsider, anonymous, suspended user, unverified-required, and not-yet-completed projects", async () => {
    const done = await completedProject();
    const open = await completedProject({ complete: false });

    actAs({ id: creator.id, role: "CREATOR" });
    expect(await createProjectReviewAction({ projectId: done.projectId, rating: 5 })).toMatchObject({ error: "FORBIDDEN" });
    const outsider = await createUser("STUDENT");
    actAs({ id: outsider.id, role: "STUDENT" });
    expect(await createProjectReviewAction({ projectId: done.projectId, rating: 5 })).toMatchObject({ error: "FORBIDDEN" });
    actAs(null);
    expect(await createProjectReviewAction({ projectId: done.projectId, rating: 5 })).toMatchObject({ error: "UNAUTHORIZED" });

    actAs({ id: open.client.id, role: "STUDENT" });
    expect(await createProjectReviewAction({ projectId: open.projectId, rating: 5 })).toMatchObject({ error: "NOT_COMPLETED" });

    await db.user.update({ where: { id: done.client.id }, data: { isActive: false } });
    actAs({ id: done.client.id, role: "STUDENT" });
    expect(await createProjectReviewAction({ projectId: done.projectId, rating: 5 })).toMatchObject({ error: "UNAUTHORIZED" });
    expect(await db.projectReview.count()).toBe(0);
  });

  it("validates input: rating 0/6/2.5/NaN, comment > 1000 chars, bad project id", async () => {
    const { client, projectId } = await completedProject();
    actAs({ id: client.id, role: "STUDENT" });
    for (const rating of [0, 6, 2.5, Number.NaN, -1]) {
      expect(await createProjectReviewAction({ projectId, rating })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    }
    expect(await createProjectReviewAction({ projectId, rating: 4, comment: "x".repeat(1001) })).toMatchObject({ error: "INVALID_INPUT" });
    expect(await createProjectReviewAction({ projectId: "not-a-cuid", rating: 4 })).toMatchObject({ error: "INVALID_INPUT" });
    expect(await db.projectReview.count()).toBe(0);
  });

  it("strips control characters from the comment and stores empty comments as null", async () => {
    const a = await completedProject(); const b = await completedProject();
    actAs({ id: a.client.id, role: "STUDENT" });
    await createProjectReviewAction({ projectId: a.projectId, rating: 3, comment: "ok\u0000\u0007 fine" });
    actAs({ id: b.client.id, role: "STUDENT" });
    await createProjectReviewAction({ projectId: b.projectId, rating: 3, comment: "   " });
    expect((await db.projectReview.findUniqueOrThrow({ where: { projectId: a.projectId } })).comment).toBe("ok fine");
    expect((await db.projectReview.findUniqueOrThrow({ where: { projectId: b.projectId } })).comment).toBeNull();
  });

  it("one review per project: a second attempt and 8 concurrent attempts yield exactly one row", async () => {
    const { client, projectId } = await completedProject();
    actAs({ id: client.id, role: "STUDENT" });
    const results = await Promise.all(Array.from({ length: 8 }, () => createProjectReviewAction({ projectId, rating: 5 })));
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success).every((r) => !r.success && r.error === "ALREADY_REVIEWED")).toBe(true);
    expect(await db.projectReview.count({ where: { projectId } })).toBe(1);
    expect(await createProjectReviewAction({ projectId, rating: 1 })).toMatchObject({ error: "ALREADY_REVIEWED" });
  });

  it("rate-limits review attempts (10/hour per user)", async () => {
    const u = await createUser("STUDENT");
    actAs({ id: u.id, role: "STUDENT" });
    const ghost = "c" + "a".repeat(24);
    const errs: string[] = [];
    for (let i = 0; i < 12; i++) { const r = await createProjectReviewAction({ projectId: ghost, rating: 5 }); errs.push(r.success ? "ok" : r.error); }
    expect(errs.slice(0, 10).every((e) => e === "NOT_FOUND")).toBe(true);
    expect(errs.slice(10)).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
  });

  it("the database itself rejects a rating outside 1..5 (CHECK constraint), even bypassing the action", async () => {
    const { client, projectId } = await completedProject();
    await expect(
      db.projectReview.create({ data: { projectId, rating: 6, reviewerId: client.id, creatorId: creator.id } })
    ).rejects.toThrow();
  });
});

describe("reputation aggregates", () => {
  it("average, count, distribution and completed projects are correct per creator and per service", async () => {
    for (const rating of [5, 4, 4]) {
      const p = await completedProject();
      actAs({ id: p.client.id, role: "STUDENT" });
      expect((await createProjectReviewAction({ projectId: p.projectId, rating })).success).toBe(true);
    }
    await completedProject(); // completed but not reviewed
    const r = await getCreatorRating(creator.id);
    expect(r).toEqual({ average: 4.3, count: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } });
    expect(await getServiceRating(serviceId)).toEqual(r);
    expect(await getCreatorCompletedProjects(creator.id)).toBe(4);
  });

  it("an unrated creator has average null (not 0)", async () => {
    expect(await getCreatorRating(creator.id)).toEqual({ average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  it("deleting the service keeps the review and the creator's rating (serviceId → null)", async () => {
    const p = await completedProject();
    actAs({ id: p.client.id, role: "STUDENT" });
    await createProjectReviewAction({ projectId: p.projectId, rating: 5 });
    await db.service.delete({ where: { id: serviceId } });
    expect((await getCreatorRating(creator.id)).count).toBe(1);
    expect((await db.projectReview.findUniqueOrThrow({ where: { projectId: p.projectId } })).serviceId).toBeNull();
  });
});
