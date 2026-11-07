/**
 * Tests for createServiceAction — full guard chain + success paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { createServiceAction } from "@/actions/marketplace/create-service";
import { scanUrls } from "@/lib/virustotal";

vi.mock("@/lib/cache", () => ({
  cacheInvalidatePattern: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/virustotal", () => ({
  scanUrl: vi.fn(),
  scanUrls: vi.fn().mockResolvedValue([]),
}));

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    courseId: "cjld2cjxh0000qzrmn831i7rn",
    categoryId: null,
    title: "I will build a Next.js app for your startup",
    description:
      "This is a professional web application building service that delivers high-quality code with tests and documentation. Covers full-stack features including authentication, database, and deployment.",
    price: 100,
    deliveryDays: 7,
    revisions: 2,
    tags: ["nextjs", "typescript"],
    portfolioLinks: [],
    ...overrides,
  };
}

async function cleanup() {
  await db.service.deleteMany({ where: { creator: { email: { endsWith: "@svc.test" } } } });
  await db.certificate.deleteMany({ where: { user: { email: { endsWith: "@svc.test" } } } });
  await db.quizAttempt.deleteMany({ where: { user: { email: { endsWith: "@svc.test" } } } });
  await db.quiz.deleteMany({ where: { course: { creator: { email: { endsWith: "@svc.test" } } } } });
  await db.course.deleteMany({ where: { creator: { email: { endsWith: "@svc.test" } } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@svc.test" } } });
}

async function createCreator(email: string, verified = true) {
  return db.user.create({
    data: {
      email,
      name: "Creator",
      role: "CREATOR",
      isActive: true,
      emailVerified: verified ? new Date() : null,
    },
  });
}

async function attachCertificate(userId: string, categoryId: string | null = null) {
  const course = await db.course.create({
    data: {
      title: "Test Course",
      slug: `svc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: "d",
      price: 0,
      status: "PUBLISHED",
      creatorId: userId,
      categoryId,
    },
  });

  // Cascade required by schema: Course -> Quiz -> QuizAttempt -> Certificate
  const quiz = await db.quiz.create({
    data: { title: "Test Quiz", courseId: course.id },
  });

  const attempt = await db.quizAttempt.create({
    data: {
      score: 90,
      passed: true,
      totalQ: 1,
      correctQ: 1,
      userId,
      quizId: quiz.id,
      courseId: course.id,
    },
  });

  await db.certificate.create({
    data: {
      userId,
      courseId: course.id,
      attemptId: attempt.id,
      credentialId: `EDU-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(16).substring(2, 14).toUpperCase()}`,
      score: 90,
      issuedAt: new Date(),
    },
  });

  return course;
}

describe("createServiceAction — guards", () => {
  beforeEach(cleanup);
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects anonymous (UNAUTHORIZED)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const r = await createServiceAction(validInput() as never);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("UNAUTHORIZED");
  });

  it("rejects STUDENT (FORBIDDEN_ROLE)", async () => {
    const student = await db.user.create({
      data: { email: "student@svc.test", name: "S", role: "STUDENT", isActive: true, emailVerified: new Date() },
    });
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: student.id } } as never);
    const r = await createServiceAction(validInput() as never);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("FORBIDDEN_ROLE");
  });

  it("rejects unverified email (EMAIL_NOT_VERIFIED)", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const u = await createCreator("unverified@svc.test", false);
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(validInput() as never);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("EMAIL_NOT_VERIFIED");
  });

  it("rejects invalid input (INVALID_INPUT)", async () => {
    const u = await createCreator("invalid@svc.test");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(validInput({ title: "x" }) as never);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("INVALID_INPUT");
  });

  it("rejects creator without certificate (NO_CERTIFICATE)", async () => {
    const u = await createCreator("nocert@svc.test");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(validInput() as never);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe("NO_CERTIFICATE");
  });

  it("blocks malicious portfolio URL (MALICIOUS_URL_BLOCKED)", async () => {
    const u = await createCreator("malicious@svc.test");
    const course = await attachCertificate(u.id);
    vi.mocked(scanUrls).mockResolvedValueOnce([
      { url: "https://evil.com/x", status: "malicious", malicious: 10, suspicious: 0, harmless: 0, undetected: 0 },
    ] as never);
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(
      validInput({ courseId: course.id, portfolioLinks: ["https://evil.com/x"] }) as never
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe("MALICIOUS_URL_BLOCKED");
      expect(r.fieldErrors?.portfolioLinks?.[0]).toContain("evil.com");
    }
  });

  it("allows creation when VirusTotal errors (fail-open)", async () => {
    const u = await createCreator("failopen@svc.test");
    const course = await attachCertificate(u.id);
    vi.mocked(scanUrls).mockResolvedValueOnce([
      { url: "https://timeout.example/x", status: "error", malicious: 0, suspicious: 0, harmless: 0, undetected: 0, errorMessage: "timeout" },
    ] as never);
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(
      validInput({ courseId: course.id, portfolioLinks: ["https://timeout.example/x"] }) as never
    );
    expect(r.success).toBe(true);
  });
});

describe("createServiceAction — success", () => {
  beforeEach(cleanup);
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("derives category from certificate (ignores user input)", async () => {
    const cat = await db.category.upsert({
      where: { name: "Dev Test" },
      update: {},
      create: { name: "Dev Test", slug: `dev-test-${Date.now()}` },
    });
    const u = await createCreator("happy@svc.test");
    const course = await attachCertificate(u.id, cat.id);
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: u.id } } as never);
    const r = await createServiceAction(
      validInput({ courseId: course.id, categoryId: null }) as never
    );
    expect(r.success).toBe(true);
    if (r.success) {
      const created = await db.service.findUnique({ where: { id: r.serviceId } });
      expect(created?.categoryId).toBe(cat.id);
      expect(created?.status).toBe("PENDING_REVIEW");
    }
  });

  it("generates unique slug on collision", async () => {
    const u = await createCreator("slug@svc.test");
    const course = await attachCertificate(u.id);
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id } } as never);
    const sameTitle = "I will build a Next.js application for your business";
    const first = await createServiceAction(validInput({ courseId: course.id, title: sameTitle }) as never);
    const second = await createServiceAction(validInput({ courseId: course.id, title: sameTitle }) as never);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.slug).not.toBe(second.slug);
      expect(second.slug).toMatch(/-1$/);
    }
  });
});
