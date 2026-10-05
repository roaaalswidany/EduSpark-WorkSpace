// ============================================================================
// اختبارات التحقّق من صحة سياسات ABAC
// تشغيل: npx vitest run src/lib/auth-guards.test.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./auth-guards";
import type { UserPermissions } from "@/types/auth";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function buildPermissions(
  overrides: Partial<UserPermissions> = {}
): UserPermissions {
  return {
    userId: "user_123",
    email: "test@eduspark.dev",
    name: "Test User",
    role: "CREATOR",
    certificates: [
      {
        id: "cert_abc",
        credentialId: "EDU-M8XK4P2-3F7A1B9",
        courseId: "course_webdev_001",
        categoryId: "cat_webdev",
        score: 92,
        issuedAt: new Date("2025-01-15"),
        courseName: "تطوير الويب الحديث مع Next.js",
        categoryName: "تطوير الويب",
        categorySlug: "web-development",
      },
    ],
    certifiedCourseIds: new Set(["course_webdev_001"]),
    certifiedCategoryIds: new Set(["cat_webdev"]),
    isActive: true,
    reputationScore: 4.8,
    ...overrides,
  };
}

// ─── Policy Tests ─────────────────────────────────────────────────────────────

describe("PolicyEngine.canPublishService", () => {
  it("يرفض مستخدماً بدور STUDENT", () => {
    const permissions = buildPermissions({ role: "STUDENT" });
    const decision = PolicyEngine.canPublishService(permissions, "course_webdev_001");
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toBe("INSUFFICIENT_ROLE");
    }
  });

  it("يرفض CREATOR بدون شهادة للمقرّر المطلوب", () => {
    const permissions = buildPermissions();
    const decision = PolicyEngine.canPublishService(permissions, "course_datascience_999");
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toBe("MISSING_CERTIFICATE");
    }
  });

  it("يسمح لـ CREATOR الذي يمتلك الشهادة الصحيحة", () => {
    const permissions = buildPermissions();
    const decision = PolicyEngine.canPublishService(permissions, "course_webdev_001");
    expect(decision.granted).toBe(true);
  });

  it("يسمح لـ ADMIN بغضّ النظر عن الشهادات", () => {
    const permissions = buildPermissions({ role: "ADMIN" });
    const decision = PolicyEngine.canPublishService(permissions, "course_nobody_has_cert");
    expect(decision.granted).toBe(true);
  });
});

describe("PolicyEngine.canOrderService", () => {
  it("يرفض الشراء الذاتي", () => {
    const permissions = buildPermissions({ userId: "creator_456" });
    const decision = PolicyEngine.canOrderService(permissions, "creator_456");
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toBe("SELF_ACTION_FORBIDDEN");
    }
  });

  it("يسمح لعميل مختلف بالشراء", () => {
    const permissions = buildPermissions({ userId: "client_789" });
    const decision = PolicyEngine.canOrderService(permissions, "creator_456");
    expect(decision.granted).toBe(true);
  });
});

describe("PolicyEngine.canApproveProject", () => {
  const project = { clientId: "client_111", creatorId: "creator_222" };

  it("يرفض المستقل من اعتماد مشروعه", () => {
    const permissions = buildPermissions({ userId: "creator_222" });
    const decision = PolicyEngine.canApproveProject(permissions, project);
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toBe("SELF_ACTION_FORBIDDEN");
    }
  });

  it("يسمح للعميل الصحيح بالاعتماد", () => {
    const permissions = buildPermissions({ userId: "client_111" });
    const decision = PolicyEngine.canApproveProject(permissions, project);
    expect(decision.granted).toBe(true);
  });

  it("يرفض عميلاً آخر غير مرتبط بالمشروع", () => {
    const permissions = buildPermissions({ userId: "random_user_999" });
    const decision = PolicyEngine.canApproveProject(permissions, project);
    expect(decision.granted).toBe(false);
  });
});