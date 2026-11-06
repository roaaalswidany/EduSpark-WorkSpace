import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { orderServiceAction } from "@/actions/projects/order-service";
import { startMilestoneAction, requestMilestoneReviewAction } from "@/actions/projects/update-project";
import { isHttpsUrl } from "@/lib/security/safe-url";
import { resetDatabase, createUser, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

let client: Awaited<ReturnType<typeof createUser>>;
let creator: Awaited<ReturnType<typeof createUser>>;
let serviceId: string;

beforeEach(async () => {
  resetSession();
  await resetDatabase();
  client = await createUser("STUDENT");
  creator = await createUser("CREATOR");
  const cat = await createCategory();
  serviceId = (await db.service.create({
    data: { title: "Logo design", slug: `s-${Date.now()}-${Math.random()}`, description: "d", price: 100,
            deliveryDays: 3, creatorId: creator.id, categoryId: cat.id },
  })).id;
});

/** Order → creator starts the milestone → returns ids, ready for a delivery submission. */
async function startedMilestone() {
  actAs({ id: client.id, role: "STUDENT" });
  const order = await orderServiceAction({ serviceId, requirements: "I need a modern logo for my startup, please." });
  if (!order.success) throw new Error("order failed: " + order.error);
  const ms = await db.milestone.findFirstOrThrow({ where: { projectId: order.projectId } });
  actAs({ id: creator.id, role: "CREATOR" });
  expect((await startMilestoneAction(ms.id)).success).toBe(true);
  return { projectId: order.projectId, milestoneId: ms.id };
}

describe("milestone delivery details (note + link)", () => {
  it("stores a valid https link and note, and shows the link in the project chat", async () => {
    const { projectId, milestoneId } = await startedMilestone();
    const url = "https://drive.example.com/folder/final-logo";
    expect((await requestMilestoneReviewAction(milestoneId, "  Final files attached.  ", url)).success).toBe(true);

    const m = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(m).toMatchObject({ status: "REVIEW_REQUESTED", submissionNote: "Final files attached.", submissionUrl: url });
    const msgs = await db.chatMessage.findMany({ where: { chatRoom: { projectId } } });
    expect(msgs.some((x) => x.content.includes(url))).toBe(true);
  });

  it("rejects javascript:, data:, file:, plain http and junk links — and the milestone stays IN_PROGRESS", async () => {
    const { milestoneId } = await startedMilestone();
    for (const bad of [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "http://example.com/plain-http",
      "//evil.example.com",
      "not a url",
    ]) {
      expect(await requestMilestoneReviewAction(milestoneId, "Delivered.", bad)).toMatchObject({
        success: false,
        error: "INVALID_INPUT",
      });
    }
    const m = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(m.status).toBe("IN_PROGRESS");
    expect(m.submissionUrl).toBeNull();
  });

  it("bounds the size of the note and of the link", async () => {
    const { milestoneId } = await startedMilestone();
    expect(await requestMilestoneReviewAction(milestoneId, "x".repeat(2001))).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect(await requestMilestoneReviewAction(milestoneId, "ok", "https://example.com/" + "a".repeat(500))).toMatchObject({ success: false, error: "INVALID_INPUT" });
    expect((await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } })).status).toBe("IN_PROGRESS");
  });

  it("empty note and link are stored as null (they are optional)", async () => {
    const { milestoneId } = await startedMilestone();
    expect((await requestMilestoneReviewAction(milestoneId, "", "")).success).toBe(true);
    const m = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(m).toMatchObject({ submissionNote: null, submissionUrl: null });
  });
});

describe("isHttpsUrl", () => {
  it("accepts https only", () => {
    expect(isHttpsUrl("https://example.com")).toBe(true);
    expect(isHttpsUrl("HTTPS://EXAMPLE.COM/a?b=1#c")).toBe(true);
    for (const bad of ["http://example.com", "javascript:alert(1)", "data:text/plain,hi", "ftp://x.com", "//x.com", "", null, undefined]) {
      expect(isHttpsUrl(bad as string | null | undefined)).toBe(false);
    }
  });
});
