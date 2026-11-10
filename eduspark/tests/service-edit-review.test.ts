/**
 * Editing an approved service: content changes send it back to review; the rest does not.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { updateServiceAction } from "@/actions/marketplace/update-service";
import { orderServiceAction } from "@/actions/projects/order-service";
import { resetDatabase, createUser } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

vi.mock("@/lib/cache", () => ({ cacheInvalidatePattern: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/virustotal", () => ({ scanUrl: vi.fn(), scanUrls: vi.fn().mockResolvedValue([]) }));

const TITLE = "I will build a Next.js app for your startup";
const DESCRIPTION =
  "This is a professional web application building service that delivers high-quality code with tests and documentation. Covers full-stack features including authentication, database, and deployment.";

async function certifiedCourse(userId: string) {
  const course = await db.course.create({
    data: { title: "Cert course", slug: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: "d", price: 0, status: "PUBLISHED", creatorId: userId },
  });
  const quiz = await db.quiz.create({ data: { title: "Quiz", courseId: course.id } });
  const attempt = await db.quizAttempt.create({
    data: { score: 90, passed: true, totalQ: 1, correctQ: 1, userId, quizId: quiz.id, courseId: course.id },
  });
  await db.certificate.create({
    data: {
      userId, courseId: course.id, attemptId: attempt.id, score: 90, issuedAt: new Date(),
      credentialId: `EDU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(16).slice(2, 14).toUpperCase().padEnd(12, "0")}`,
    },
  });
  return course;
}

async function setup(status: "ACTIVE" | "PAUSED" | "PENDING_REVIEW" = "ACTIVE", role: "CREATOR" | "ADMIN" = "CREATOR") {
  const creator = await createUser(role);
  const course = await certifiedCourse(creator.id);
  const service = await db.service.create({
    data: {
      title: TITLE, slug: `se-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: DESCRIPTION,
      price: 100, deliveryDays: 7, revisions: 2, tags: ["nextjs", "typescript"], portfolioLinks: ["https://example.com/a"],
      creatorId: creator.id, status,
    },
  });
  actAs({ id: creator.id, role });
  const edit = (over: Record<string, unknown> = {}) =>
    updateServiceAction({
      serviceId: service.id, courseId: course.id, categoryId: null, title: TITLE, description: DESCRIPTION,
      price: 100, deliveryDays: 7, revisions: 2, tags: ["nextjs", "typescript"], portfolioLinks: ["https://example.com/a"],
      ...over,
    } as Parameters<typeof updateServiceAction>[0]);
  return { creator, course, service, edit };
}
const statusOf = async (id: string) => (await db.service.findUniqueOrThrow({ where: { id } })).status;

beforeEach(async () => { await resetDatabase(); resetSession(); });

describe("editing an approved service", () => {
  it("changing the TITLE sends it back to review and hides it (sentToReview = true)", async () => {
    const admin = await createUser("ADMIN");
    const { service, edit } = await setup();
    const res = await edit({ title: "I will build a Next.js app and an API for your startup" });
    expect(res).toMatchObject({ success: true, sentToReview: true });
    const after = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(after.status).toBe("PENDING_REVIEW");
    expect(after.submittedAt).not.toBeNull();
    expect(await db.notification.count({ where: { userId: admin.id, title: { contains: "awaiting review" } } })).toBe(1);
  });

  it("changing the DESCRIPTION or the portfolio LINKS also triggers a review", async () => {
    const a = await setup();
    expect(await a.edit({ description: DESCRIPTION + " Now with extra features and a longer description." })).toMatchObject({ success: true, sentToReview: true });
    const b = await setup();
    expect(await b.edit({ portfolioLinks: ["https://example.com/a", "https://example.com/b"] })).toMatchObject({ success: true, sentToReview: true });
    expect(await statusOf(b.service.id)).toBe("PENDING_REVIEW");
  });

  it("changing only price, delivery time, revisions or tags does NOT trigger a review", async () => {
    const { service, edit } = await setup();
    expect(await edit({ price: 250, deliveryDays: 10, revisions: 3, tags: ["nextjs"] })).toMatchObject({ success: true, sentToReview: false });
    const after = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(after).toMatchObject({ status: "ACTIVE", deliveryDays: 10, revisions: 3 });
    expect(Number(after.price)).toBe(250); // Decimal column
  });

  it("saving without any change keeps the service ACTIVE", async () => {
    const { service, edit } = await setup();
    expect(await edit()).toMatchObject({ success: true, sentToReview: false });
    expect(await statusOf(service.id)).toBe("ACTIVE");
  });

  it("editing a PAUSED or already pending service never activates or re-queues it by itself", async () => {
    const paused = await setup("PAUSED");
    expect(await paused.edit({ title: "A completely different service title here" })).toMatchObject({ success: true, sentToReview: false });
    expect(await statusOf(paused.service.id)).toBe("PAUSED");
    const pending = await setup("PENDING_REVIEW");
    expect(await pending.edit({ title: "Another different service title right here" })).toMatchObject({ success: true, sentToReview: false });
    expect(await statusOf(pending.service.id)).toBe("PENDING_REVIEW");
  });

  it("an admin editing their own service is never re-queued", async () => {
    const { service, edit } = await setup("ACTIVE", "ADMIN");
    expect(await edit({ title: "Admin edited this service title today" })).toMatchObject({ success: true, sentToReview: false });
    expect(await statusOf(service.id)).toBe("ACTIVE");
  });

  it("the edited service really disappears: it cannot be ordered until it is approved again", async () => {
    const { service, edit } = await setup();
    const client = await createUser("STUDENT");
    const order = () => { actAs({ id: client.id, role: "STUDENT" }); return orderServiceAction({ serviceId: service.id, requirements: "I need a modern logo for my startup, please." }); };
    await edit({ title: "A new and quite different service title" });
    expect(await order()).toMatchObject({ success: false, error: "SERVICE_INACTIVE" });
  });
});
