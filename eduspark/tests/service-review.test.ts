import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { updateServiceStatusAction } from "@/actions/marketplace/update-service-status";
import { reviewServiceAction } from "@/actions/admin/review-service";
import { orderServiceAction } from "@/actions/projects/order-service";
import { creatorMayMoveService } from "@/lib/marketplace/service-status";
import { resetDatabase, createUser, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";
import { outbox, clearOutbox } from "./helpers/mail";

type Status = "ACTIVE" | "PAUSED" | "PENDING_REVIEW" | "ARCHIVED";

async function makeService(creatorId: string, status: Status, extra: Record<string, unknown> = {}) {
  const cat = await createCategory();
  const slug = `sr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return db.service.create({
    data: {
      title: `Service ${slug}`, slug, description: "d", price: 100, deliveryDays: 3,
      creatorId, categoryId: cat.id, status, ...extra,
    },
  });
}
const asCreator = (u: { id: string }) => actAs({ id: u.id, role: "CREATOR" });
const asAdmin = (u: { id: string }) => actAs({ id: u.id, role: "ADMIN" });
const statusOf = async (id: string) => (await db.service.findUniqueOrThrow({ where: { id } })).status;
async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 4000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeEach(async () => { await resetDatabase(); resetSession(); clearOutbox(); });

describe("service status — creators can never activate; the rules live on the SERVER", () => {
  const ALLOWED: [Status, Status][] = [
    ["ACTIVE", "PAUSED"], ["PAUSED", "PENDING_REVIEW"], ["PAUSED", "ARCHIVED"], ["PENDING_REVIEW", "PAUSED"],
  ];
  const DENIED: [Status, Status][] = [
    ["PENDING_REVIEW", "ACTIVE"], ["PAUSED", "ACTIVE"], ["ARCHIVED", "ACTIVE"], ["ARCHIVED", "PAUSED"],
    ["ARCHIVED", "PENDING_REVIEW"], ["ACTIVE", "PENDING_REVIEW"], ["ACTIVE", "ARCHIVED"],
    ["PENDING_REVIEW", "ARCHIVED"], ["PAUSED", "PAUSED"],
  ];

  it("allows exactly the documented moves and refuses everything else (status stays untouched)", async () => {
    const creator = await createUser("CREATOR"); asCreator(creator);
    for (const [from, to] of ALLOWED) {
      const s = await makeService(creator.id, from);
      expect(await updateServiceStatusAction({ serviceId: s.id, status: to })).toMatchObject({ success: true, newStatus: to });
      expect(await statusOf(s.id)).toBe(to);
      expect(creatorMayMoveService(from, to)).toBe(true);
    }
    for (const [from, to] of DENIED) {
      const s = await makeService(creator.id, from);
      expect(await updateServiceStatusAction({ serviceId: s.id, status: to })).toMatchObject({ success: false, error: "INVALID_TRANSITION" });
      expect(await statusOf(s.id)).toBe(from);
      expect(creatorMayMoveService(from, to)).toBe(false);
    }
  });

  it("the two-step bypass fails: PENDING_REVIEW → PAUSED works, but PAUSED → ACTIVE is refused", async () => {
    const creator = await createUser("CREATOR"); asCreator(creator);
    const s = await makeService(creator.id, "PENDING_REVIEW");
    expect((await updateServiceStatusAction({ serviceId: s.id, status: "PAUSED" })).success).toBe(true);
    expect(await updateServiceStatusAction({ serviceId: s.id, status: "ACTIVE" })).toMatchObject({ success: false, error: "INVALID_TRANSITION" });
    expect(await statusOf(s.id)).toBe("PAUSED");
  });

  it("a service archived by an admin cannot be brought back by its creator", async () => {
    const creator = await createUser("CREATOR"); asCreator(creator);
    const s = await makeService(creator.id, "ARCHIVED");
    for (const to of ["ACTIVE", "PAUSED", "PENDING_REVIEW"] as const) {
      expect(await updateServiceStatusAction({ serviceId: s.id, status: to })).toMatchObject({ success: false, error: "INVALID_TRANSITION" });
    }
    expect(await statusOf(s.id)).toBe("ARCHIVED");
  });

  it("refuses: anonymous, another creator, a suspended owner, invalid input, unknown service", async () => {
    const creator = await createUser("CREATOR"); const other = await createUser("CREATOR");
    const s = await makeService(creator.id, "ACTIVE");
    actAs(null);
    expect(await updateServiceStatusAction({ serviceId: s.id, status: "PAUSED" })).toMatchObject({ success: false, error: "UNAUTHORIZED" });
    asCreator(other);
    expect(await updateServiceStatusAction({ serviceId: s.id, status: "PAUSED" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    await db.user.update({ where: { id: creator.id }, data: { isActive: false } });
    asCreator(creator);
    expect(await updateServiceStatusAction({ serviceId: s.id, status: "PAUSED" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    await db.user.update({ where: { id: creator.id }, data: { isActive: true } });
    expect(await updateServiceStatusAction({ serviceId: "nope", status: "PAUSED" })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await updateServiceStatusAction({ serviceId: s.id, status: "DELETED" as never })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await updateServiceStatusAction({ serviceId: "cjld2cjxh0000qzrmn831i7rn", status: "PAUSED" })).toMatchObject({ success: false, error: "NOT_FOUND" });
    expect(await statusOf(s.id)).toBe("ACTIVE");
  });

  it("submitting for review stamps submittedAt, clears the old note, notifies the other admins and is audited", async () => {
    const creator = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const s = await makeService(creator.id, "PAUSED", { reviewNote: "Please fix the description." });
    asCreator(creator);
    expect((await updateServiceStatusAction({ serviceId: s.id, status: "PENDING_REVIEW" })).success).toBe(true);
    const after = await db.service.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.submittedAt).not.toBeNull();
    expect(after.reviewNote).toBeNull();
    expect(await db.notification.count({ where: { userId: admin.id, title: { contains: "awaiting review" } } })).toBe(1);
    await until(() => db.auditLog.findFirst({ where: { action: "creator.service.submitted_for_review", targetId: s.id } }));
  });

  it("5 concurrent pause requests: exactly ONE wins (compare-and-set)", async () => {
    const creator = await createUser("CREATOR"); asCreator(creator);
    const s = await makeService(creator.id, "ACTIVE");
    const res = await Promise.all(Array.from({ length: 5 }, () => updateServiceStatusAction({ serviceId: s.id, status: "PAUSED" })));
    expect(res.filter((r) => r.success)).toHaveLength(1);
    expect(res.filter((r) => !r.success).every((r) => !r.success && r.error === "INVALID_TRANSITION")).toBe(true);
  });
});

describe("admin review of services", () => {
  async function pending() {
    const creator = await createUser("CREATOR"); const admin = await createUser("ADMIN");
    const service = await makeService(creator.id, "PENDING_REVIEW");
    return { creator, admin, service };
  }

  it("only a real admin can decide: creator, student, forged-ADMIN JWT and anonymous are refused", async () => {
    const { creator, service } = await pending();
    asCreator(creator);
    expect(await reviewServiceAction({ serviceId: service.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    const forger = await createUser("STUDENT"); actAs({ id: forger.id, role: "ADMIN" });
    expect(await reviewServiceAction({ serviceId: service.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "FORBIDDEN" });
    actAs(null);
    expect(await reviewServiceAction({ serviceId: service.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "UNAUTHORIZED" });
    expect(await statusOf(service.id)).toBe("PENDING_REVIEW");
  });

  it("approve → ACTIVE, records the reviewer, notifies + emails the creator, writes an audit entry", async () => {
    const { creator, admin, service } = await pending();
    asAdmin(admin); clearOutbox();
    expect(await reviewServiceAction({ serviceId: service.id, decision: "APPROVE" })).toMatchObject({ success: true, status: "ACTIVE" });
    const after = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(after).toMatchObject({ status: "ACTIVE", reviewedById: admin.id });
    expect(after.reviewedAt).not.toBeNull();
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "approved" } } })).toBe(1);
    expect(outbox().some((m) => m.to === creator.email && /live/i.test(m.subject))).toBe(true);
    await until(() => db.auditLog.findFirst({ where: { action: "admin.service.approved", targetId: service.id } }));
  });

  it("the gate has teeth: a pending service cannot be ordered, an approved one can", async () => {
    const { admin, service } = await pending();
    const client = await createUser("STUDENT");
    const order = () => { actAs({ id: client.id, role: "STUDENT" }); return orderServiceAction({ serviceId: service.id, requirements: "I need a modern logo for my startup, please." }); };
    expect(await order()).toMatchObject({ success: false, error: "SERVICE_INACTIVE" });
    asAdmin(admin);
    await reviewServiceAction({ serviceId: service.id, decision: "APPROVE" });
    expect((await order()).success).toBe(true);
  });

  it("reject needs a real note, PAUSES the service (not archives), shows the note; resubmitting clears it", async () => {
    const { creator, admin, service } = await pending();
    asAdmin(admin);
    expect(await reviewServiceAction({ serviceId: service.id, decision: "REJECT" })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await reviewServiceAction({ serviceId: service.id, decision: "REJECT", note: "too short" })).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await statusOf(service.id)).toBe("PENDING_REVIEW");

    const note = "The description promises things the portfolio does not show.";
    clearOutbox();
    expect(await reviewServiceAction({ serviceId: service.id, decision: "REJECT", note })).toMatchObject({ success: true, status: "PAUSED" });
    const after = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(after).toMatchObject({ status: "PAUSED", reviewNote: note });
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "Changes requested" } } })).toBe(1);
    expect(outbox().some((m) => m.to === creator.email && /changes requested/i.test(m.subject))).toBe(true);
    await until(() => db.auditLog.findFirst({ where: { action: "admin.service.rejected", targetId: service.id } }));

    asCreator(creator);
    expect((await updateServiceStatusAction({ serviceId: service.id, status: "PENDING_REVIEW" })).success).toBe(true);
    expect((await db.service.findUniqueOrThrow({ where: { id: service.id } })).reviewNote).toBeNull();
  });

  it("only a PENDING_REVIEW service can be reviewed", async () => {
    const admin = await createUser("ADMIN"); const creator = await createUser("CREATOR");
    const active = await makeService(creator.id, "ACTIVE");
    asAdmin(admin);
    expect(await reviewServiceAction({ serviceId: active.id, decision: "APPROVE" })).toMatchObject({ success: false, error: "INVALID_STATE" });
  });

  it("5 concurrent approvals: exactly ONE decision is recorded", async () => {
    const { creator, admin, service } = await pending();
    asAdmin(admin);
    const res = await Promise.all(Array.from({ length: 5 }, () => reviewServiceAction({ serviceId: service.id, decision: "APPROVE" })));
    expect(res.filter((r) => r.success)).toHaveLength(1);
    expect(res.filter((r) => !r.success).every((r) => !r.success && r.error === "INVALID_STATE")).toBe(true);
    expect(await db.notification.count({ where: { userId: creator.id, title: { contains: "approved" } } })).toBe(1);
  });
});
