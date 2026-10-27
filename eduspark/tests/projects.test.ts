import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { orderServiceAction } from "@/actions/projects/order-service";
import {
  startMilestoneAction, requestMilestoneReviewAction,
  requestMilestoneRevisionAction, approveProjectCompletionAction,
} from "@/actions/projects/update-project";
import { resetDatabase, createUser, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

let client: Awaited<ReturnType<typeof createUser>>;
let creator: Awaited<ReturnType<typeof createUser>>;
let outsider: Awaited<ReturnType<typeof createUser>>;
let serviceId: string;

beforeAll(resetDatabase);
beforeEach(async () => {
  resetSession();
  client = await createUser("STUDENT");
  creator = await createUser("CREATOR");
  outsider = await createUser("CREATOR");
  const cat = await createCategory();
  const s = await db.service.create({
    data: { title: "Logo design", slug: `s-${Date.now()}-${Math.random()}`, description: "d", price: 100,
            deliveryDays: 3, creatorId: creator.id, categoryId: cat.id },
  });
  serviceId = s.id;
});

async function placeOrder() {
  actAs({ id: client.id, role: "STUDENT" });
  const res = await orderServiceAction({ serviceId, requirements: "I need a modern logo for my startup, please." });
  if (!res.success) throw new Error("order failed: " + res.error);
  const ms = await db.milestone.findFirstOrThrow({ where: { projectId: res.projectId } });
  return { projectId: res.projectId, milestoneId: ms.id };
}

describe("order → project lifecycle (happy path)", () => {
  it("PENDING → IN_PROGRESS → REVIEW_REQUESTED → COMPLETED, with the right actors", async () => {
    const { projectId, milestoneId } = await placeOrder();

    actAs({ id: creator.id, role: "CREATOR" });
    expect((await startMilestoneAction(milestoneId)).success).toBe(true);
    expect((await requestMilestoneReviewAction(milestoneId)).success).toBe(true);
    expect((await db.project.findUnique({ where: { id: projectId } }))?.status).toBe("REVIEW_REQUESTED");

    actAs({ id: client.id, role: "STUDENT" });
    expect((await approveProjectCompletionAction(projectId)).success).toBe(true);
    const p = await db.project.findUnique({ where: { id: projectId }, include: { milestones: true } });
    expect(p?.status).toBe("COMPLETED");
    expect(p?.milestones.every((m) => m.status === "APPROVED")).toBe(true);
  });

  it("the creator notification no longer promises a payout that does not exist", async () => {
    const { projectId, milestoneId } = await placeOrder();
    actAs({ id: creator.id, role: "CREATOR" });
    await startMilestoneAction(milestoneId); await requestMilestoneReviewAction(milestoneId);
    actAs({ id: client.id, role: "STUDENT" });
    await approveProjectCompletionAction(projectId);
    const notes = await db.notification.findMany({ where: { userId: creator.id } });
    expect(notes.some((n) => /payment will be released/i.test(n.body))).toBe(false);
  });
});

describe("authorization & invalid transitions", () => {
  it("only the assigned creator can start; only the client can approve/revise", async () => {
    const { projectId, milestoneId } = await placeOrder();

    for (const who of [client, outsider]) {
      actAs({ id: who.id, role: "CREATOR" });
      const r = await startMilestoneAction(milestoneId);
      expect(r.success).toBe(false);
    }
    actAs({ id: creator.id, role: "CREATOR" });
    await startMilestoneAction(milestoneId); await requestMilestoneReviewAction(milestoneId);

    actAs({ id: creator.id, role: "CREATOR" }); // creator cannot self-approve
    expect((await approveProjectCompletionAction(projectId)).success).toBe(false);
    expect((await requestMilestoneRevisionAction(milestoneId, "this is a long enough note")).success).toBe(false);
    actAs({ id: outsider.id, role: "CREATOR" });
    expect((await approveProjectCompletionAction(projectId)).success).toBe(false);
    expect((await db.project.findUnique({ where: { id: projectId } }))?.status).toBe("REVIEW_REQUESTED");
  });

  it("cannot approve before review, nor skip states", async () => {
    const { projectId, milestoneId } = await placeOrder();
    actAs({ id: client.id, role: "STUDENT" });
    expect((await approveProjectCompletionAction(projectId)).success).toBe(false);
    actAs({ id: creator.id, role: "CREATOR" });
    expect((await requestMilestoneReviewAction(milestoneId)).success).toBe(false); // PENDING → REVIEW not allowed
  });
});

describe("F14 — compare-and-set transitions under concurrency", () => {
  it("10 concurrent approvals: exactly ONE succeeds, project completed once", async () => {
    const { projectId, milestoneId } = await placeOrder();
    actAs({ id: creator.id, role: "CREATOR" });
    await startMilestoneAction(milestoneId); await requestMilestoneReviewAction(milestoneId);
    actAs({ id: client.id, role: "STUDENT" });
    const results = await Promise.all(Array.from({ length: 10 }, () => approveProjectCompletionAction(projectId)));
    expect(results.filter((r) => r.success).length).toBe(1);
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "Completed" } } })).toBe(1);
  });

  it("10 concurrent 'start' calls: exactly ONE succeeds", async () => {
    const { milestoneId } = await placeOrder();
    actAs({ id: creator.id, role: "CREATOR" });
    const results = await Promise.all(Array.from({ length: 10 }, () => startMilestoneAction(milestoneId)));
    expect(results.filter((r) => r.success).length).toBe(1);
  });
});

describe("ordering guards", () => {
  it("cannot order your own service, nor as a suspended user, nor from a suspended creator", async () => {
    actAs({ id: creator.id, role: "CREATOR" });
    expect((await orderServiceAction({ serviceId, requirements: "x".repeat(30) }))).toMatchObject({ error: "SELF_ORDER" });

    await db.user.update({ where: { id: client.id }, data: { isActive: false } });
    actAs({ id: client.id, role: "STUDENT" });
    expect(await orderServiceAction({ serviceId, requirements: "x".repeat(30) })).toMatchObject({ error: "ACCOUNT_DISABLED" });

    await db.user.update({ where: { id: client.id }, data: { isActive: true } });
    await db.user.update({ where: { id: creator.id }, data: { isActive: false } });
    expect(await orderServiceAction({ serviceId, requirements: "x".repeat(30) })).toMatchObject({ error: "SERVICE_INACTIVE" });
  });

  it("rate-limits orders (10/hour)", async () => {
    actAs({ id: client.id, role: "STUDENT" });
    const out = [];
    for (let i = 0; i < 12; i++) out.push(await orderServiceAction({ serviceId, requirements: "I need a logo, thanks a lot!!" }));
    expect(out.filter((r) => r.success).length).toBe(10);
    expect(out.slice(10).every((r) => !r.success && r.error === "RATE_LIMITED")).toBe(true);
  });
});
