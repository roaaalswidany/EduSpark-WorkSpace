// ============================================================================
// نقطة الحقيقة الوحيدة لأنواع المصادقة والتفويض في المشروع بأكمله
// ============================================================================

import type { Role } from "@prisma/client";

// ─── JWT Payload المُخزَّن في NextAuth Session ────────────────────────────────
// هذا ما يُشفَّر في الـ Token ويُفكَّك عند كل طلب
export interface EduSparkJWTPayload {
  sub: string;          // User.id — المعرّف الأساسي
  email: string;
  name: string;
  role: Role;
  picture: string | null;
  iat: number;          // وقت الإصدار (issued at)
  exp: number;          // وقت الانتهاء (expiration)
  jti?: string;         // معرّف فريد للـ Token (للإلغاء المستقبلي)
}

// ─── معلومات الشهادة المُجلَبة من قاعدة البيانات ─────────────────────────────
export interface CertificateInfo {
  id: string;
  credentialId: string;
  courseId: string;
  categoryId: string | null;
  score: number;
  issuedAt: Date;
  // الحقول المُدمَجة من العلاقات للتجنّب استعلامات إضافية
  courseName: string;
  categoryName: string | null;
  categorySlug: string | null;
}

// ─── كائن الصلاحيات الكامل المبني عند كل طلب ────────────────────────────────
// هذا هو "بطاقة الهوية الكاملة" للمستخدم داخل كل Request Handler
export interface UserPermissions {
  // البيانات الأساسية من JWT
  userId: string;
  email: string;
  name: string;
  role: Role;

  // الكفاءات المُثبَتة — مُجلَبة من DB
  certificates: CertificateInfo[];

  // خرائط فهرسة سريعة لتجنّب loops متكرّرة
  // مثال: certifiedCourseIds.has("clx123") → true/false في O(1)
  certifiedCourseIds: Set<string>;
  certifiedCategoryIds: Set<string>;

  // حالة الحساب
  isActive: boolean;
  reputationScore: number;
}

// ─── نتيجة قرار التفويض ───────────────────────────────────────────────────────
export type AuthorizationDecision =
  | { granted: true }
  | {
      granted: false;
      reason: AuthDenialReason;
      message: string;
      // بيانات إضافية للـ Client لتوجيه المستخدم
      metadata?: Record<string, unknown>;
    };

// ─── أسباب الرفض الموحَّدة عبر النظام ────────────────────────────────────────
export type AuthDenialReason =
  | "UNAUTHENTICATED"         // لا جلسة صالحة
  | "ACCOUNT_DISABLED"        // الحساب مُعطَّل
  | "INSUFFICIENT_ROLE"       // الدور لا يكفي
  | "MISSING_CERTIFICATE"     // لا شهادة للمقرّر المطلوب
  | "SELF_ACTION_FORBIDDEN"   // محاولة تنفيذ إجراء على مورد المستخدم نفسه
  | "RESOURCE_NOT_FOUND"      // المورد المستهدَف غير موجود
  | "INVALID_TRANSITION"      // انتقال حالة غير مسموح به
  | "RATE_LIMITED"            // تجاوز حد المعدّل
  | "POLICY_VIOLATION";       // انتهاك قاعدة أعمالية عامة

// ─── خيارات الـ Guard ─────────────────────────────────────────────────────────
export interface GuardOptions {
  // الأدوار المسموح لها — إن كانت فارغة: أي دور مُصادَق عليه
  allowedRoles?: Role[];
  // تحميل الشهادات من DB؟ (اختياري للمسارات البسيطة التي لا تحتاجها)
  loadCertificates?: boolean;
  // السماح لـ Admin بتجاوز كل القيود تلقائياً؟
  adminBypass?: boolean;
}