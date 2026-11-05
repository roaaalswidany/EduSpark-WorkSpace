/**
 * Security tests for storage actions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { deleteAttachmentAction } from "@/actions/storage/delete-attachment";
import { getAttachmentDownloadUrlAction } from "@/actions/storage/get-download-url";

// Silence S3 client — no real network calls.
vi.mock("@/lib/s3-client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  UPLOAD_BUCKET: "test-bucket",
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  ALLOWED_MIME_TYPES: new Set(["application/pdf"]),
}));

// Mock the presigner — it normally needs a fully-constructed S3 client.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock-signed-url.example.com/file.pdf"),
}));

describe("deleteAttachmentAction — project status guard", () => {
  let creatorId: string, outsiderId: string, adminId: string;
  let completedAttachmentId: string;

  beforeEach(async () => {
    await db.attachment.deleteMany({});
    await db.milestone.deleteMany({});
    await db.project.deleteMany({});
    await db.user.deleteMany({ where: { email: { endsWith: "@storage.test" } } });

    const creator = await db.user.create({ data: { email: "creator@storage.test", name: "Creator", role: "CREATOR", isActive: true } });
    const outsider = await db.user.create({ data: { email: "outsider@storage.test", name: "Outsider", role: "CREATOR", isActive: true } });
    const admin = await db.user.create({ data: { email: "admin@storage.test", name: "Admin", role: "ADMIN", isActive: true } });
    creatorId = creator.id;
    outsiderId = outsider.id;
    adminId = admin.id;

    const project = await db.project.create({
      data: {
        title: "Completed Project",
        description: "Test",
        budget: 100,
        status: "COMPLETED",
        clientId: outsiderId,
        creatorId: creatorId,
      },
    });

    const milestone = await db.milestone.create({
      data: {
        title: "M1",
        description: "Test",
        status: "PENDING",
        order: 1,
        amount: 100,
        projectId: project.id,
      },
    });

    const attachment = await db.attachment.create({
      data: {
        fileName: "final.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
        storageKey: "milestone/test.pdf",
        status: "CONFIRMED",
        uploadedById: creatorId,
        milestoneId: milestone.id,
      },
    });
    completedAttachmentId = attachment.id;
  });

  it("blocks the creator from deleting an attachment on a COMPLETED project", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: creatorId, role: "CREATOR" } } as any);
    const result = await deleteAttachmentAction({ attachmentId: completedAttachmentId });
    expect(result.success).toBe(false);
    expect(result.error).toBe("FORBIDDEN");
  });

  it("blocks an outsider from deleting any attachment", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: outsiderId, role: "CREATOR" } } as any);
    const result = await deleteAttachmentAction({ attachmentId: completedAttachmentId });
    expect(result.success).toBe(false);
    expect(result.error).toBe("FORBIDDEN");
  });

  it("allows the admin to delete an attachment on a COMPLETED project", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: adminId, role: "ADMIN" } } as any);
    const result = await deleteAttachmentAction({ attachmentId: completedAttachmentId });
    expect(result.success).toBe(true);
    const stillThere = await db.attachment.findUnique({ where: { id: completedAttachmentId } });
    expect(stillThere).toBeNull();
  });
});

describe("getAttachmentDownloadUrlAction — access control", () => {
  let creatorId: string, outsiderId: string;
  let attachmentId: string;

  beforeEach(async () => {
    await db.attachment.deleteMany({});
    await db.milestone.deleteMany({});
    await db.project.deleteMany({});
    await db.user.deleteMany({ where: { email: { endsWith: "@storage2.test" } } });

    const creator = await db.user.create({ data: { email: "creator@storage2.test", name: "Creator", role: "CREATOR", isActive: true } });
    const outsider = await db.user.create({ data: { email: "outsider@storage2.test", name: "Outsider", role: "CREATOR", isActive: true } });
    creatorId = creator.id;
    outsiderId = outsider.id;

    const project = await db.project.create({
      data: { title: "P", description: "d", budget: 10, status: "IN_PROGRESS", clientId: outsiderId, creatorId },
    });
    const milestone = await db.milestone.create({
      data: { title: "M", description: "d", status: "PENDING", order: 1, amount: 10, projectId: project.id },
    });
    const att = await db.attachment.create({
      data: {
        fileName: "file.pdf", mimeType: "application/pdf", fileSizeBytes: 10,
        storageKey: "milestone/x.pdf", status: "CONFIRMED",
        uploadedById: creatorId, milestoneId: milestone.id,
      },
    });
    attachmentId = att.id;
  });

  it("allows the creator (project participant) to get a download URL", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: creatorId, role: "CREATOR" } } as any);
    const result = await getAttachmentDownloadUrlAction({ attachmentId });
    expect(result.success).toBe(true);
  });

  it("allows the client (project participant) to get a download URL", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: outsiderId, role: "CREATOR" } } as any);
    const result = await getAttachmentDownloadUrlAction({ attachmentId });
    expect(result.success).toBe(true);
  });

  it("blocks a suspended user even if they are a participant", async () => {
    await db.user.update({ where: { id: creatorId }, data: { isActive: false } });
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: creatorId, role: "CREATOR" } } as any);
    const result = await getAttachmentDownloadUrlAction({ attachmentId });
    expect(result.success).toBe(false);
  });
});
