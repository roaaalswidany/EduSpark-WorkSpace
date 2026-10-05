// ============================================================================
// POST /api/services/publish
// نقطة نهاية نشر الخدمة مع تطبيق ABAC كامل
//
// سلسلة التحقّق:
// 1. withAuth() → جلسة صالحة؟
// 2. allowedRoles: ["CREATOR"] → الدور صحيح؟
// 3. PolicyEngine.canPublishService() → شهادة موجودة؟
// 4. Zod validation → البيانات صحيحة؟
// 5. DB write → نشر الخدمة
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  PolicyEngine,
  enforceDecision,
  createErrorResponse,
} from "@/lib/auth-guards";
import { db } from "@/lib/db";
import type { UserPermissions } from "@/types/auth";

// ─── Validation Schema ────────────────────────────────────────────────────────

const PublishServiceSchema = z.object({
  title: z
    .string()
    .min(10, "العنوان يجب أن يكون 10 أحرف على الأقل.")
    .max(100, "العنوان يجب ألّا يتجاوز 100 حرف.")
    .trim(),

  description: z
    .string()
    .min(50, "الوصف يجب أن يكون 50 حرفاً على الأقل.")
    .max(3000, "الوصف يجب ألّا يتجاوز 3000 حرف.")
    .trim(),

  // courseId: المقرّر الذي اجتاز فيه المستقل الاختبار
  // هذا هو محور قرار الـ ABAC — هل يمتلك شهادة لهذا المقرّر؟
  courseId: z.string().cuid("معرّف المقرّر غير صالح."),

  categoryId: z.string().cuid("معرّف الفئة غير صالح.").nullable().optional(),

  price: z
    .number()
    .min(5, "الحدّ الأدنى للسعر هو 5 دولار.")
    .max(10_000, "الحدّ الأقصى للسعر هو 10,000 دولار."),

  deliveryDays: z
    .number()
    .int()
    .min(1, "وقت التسليم يجب أن يكون يوماً واحداً على الأقل.")
    .max(90, "الحدّ الأقصى لوقت التسليم 90 يوماً."),

  revisions: z
    .number()
    .int()
    .min(0)
    .max(20)
    .default(1),

  tags: z
    .array(z.string().min(2).max(30).toLowerCase().trim())
    .min(1, "أضف وسماً واحداً على الأقل.")
    .max(5, "الحدّ الأقصى 5 وسوم.")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "الوسوم يجب أن تكون فريدة."
    ),

  portfolioLinks: z
    .array(z.string().url("كل رابط يجب أن يكون URL صالحاً."))
    .max(5, "الحدّ الأقصى 5 روابط.")
    .default([]),
});

type PublishServiceInput = z.infer<typeof PublishServiceSchema>;

// ─── Slug Generator ────────────────────────────────────────────────────────────

function toBaseSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\u0600-\u06FF\s]+/g, "-") // العربية → شرطات
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug || "service";
  let attempt = 0;

  while (attempt < 10) {
    const existing = await db.service.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;

    attempt++;
    candidate = `${baseSlug}-${attempt}`;
  }

  // Fallback: أضف timestamp لضمان التفرّد
  return `${baseSlug}-${Date.now().toString(36)}`;
}

// ─── Core Handler ────────────────────────────────────────────────────────────

async function publishServiceHandler(
  req: NextRequest,
  permissions: UserPermissions,
  body: PublishServiceInput
): Promise<NextResponse> {

  // ── Step 1: التحقّق من صحة بيانات الطلب ─────────────────────────────────
  const parsed = PublishServiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          reason: "INVALID_INPUT",
          message: "بيانات الخدمة تحتوي على أخطاء.",
          fieldErrors: parsed.error.flatten().fieldErrors,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  const {
    title,
    description,
    courseId,
    categoryId,
    price,
    deliveryDays,
    revisions,
    tags,
    portfolioLinks,
  } = parsed.data;

  // ── Step 2: تطبيق سياسة ABAC — الحارس الأمني الرئيسي ────────────────────
  //
  // هذا هو قلب النظام:
  // PolicyEngine يتحقّق مما إذا كان المستخدم يمتلك شهادة
  // للمقرّر courseId الذي يريد نشر خدمة تحته.
  //
  // permissions.certifiedCourseIds هو Set مُحمَّل من DB في withAuth()
  // التحقّق O(1) بالضبط — لا استعلام إضافي هنا.
  const serviceDecision = PolicyEngine.canPublishService(
    permissions,
    courseId
  );

  // enforceDecision تُعيد NextResponse 403 إن كان القرار مرفوضاً، أو null إن كان مسموحاً
  const denial = enforceDecision(serviceDecision);
  if (denial) return denial;

  // ── Step 3: التحقّق من وجود المقرّر في DB (لا نثق بـ courseId من العميل وحده) ──
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      status: true,
      category: { select: { id: true, name: true } },
    },
  });

  if (!course || course.status !== "PUBLISHED") {
    return createErrorResponse("RESOURCE_NOT_FOUND", 404, {
      message: "المقرّر المحدَّد غير موجود أو غير منشور.",
      metadata: { courseId },
    });
  }

  // ── Step 4: التحقّق من أن الفئة المُحدَّدة تتوافق مع فئة المقرّر ──────────
  // هذا يمنع نشر خدمة في "تطوير الويب" بشهادة "تصميم الجرافيك"
  if (categoryId && course.category?.id && categoryId !== course.category.id) {
    return NextResponse.json(
      {
        success: false,
        error: {
          reason: "POLICY_VIOLATION",
          message:
            `فئة الخدمة المُختارة (${categoryId}) لا تتطابق مع فئة المقرّر "${course.title}" (${course.category.name}). ` +
            "يجب أن تنشر خدمتك في نفس الفئة التي تمتلك فيها شهادة.",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 403 }
    );
  }

  // ── Step 5: توليد Slug فريد وإنشاء الخدمة ────────────────────────────────
  const baseSlug = toBaseSlug(title);
  const uniqueSlug = await generateUniqueSlug(baseSlug);

  try {
    const service = await db.service.create({
      data: {
        title,
        slug: uniqueSlug,
        description,
        price,
        deliveryDays,
        revisions,
        tags,
        portfolioLinks,
        status: "ACTIVE",
        creatorId: permissions.userId,
        requiredCourseId: courseId,
        categoryId: categoryId ?? course.category?.id ?? null,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        createdAt: true,
        category: { select: { name: true, slug: true } },
      },
    });

    // ── Step 6: استجابة 200 مُفصَّلة بكل المعلومات المفيدة للواجهة ──────────
    return NextResponse.json(
      {
        success: true,
        data: {
          service: {
            id: service.id,
            title: service.title,
            slug: service.slug,
            status: service.status,
            createdAt: service.createdAt,
            category: service.category,
            // رابط مباشر للخدمة المنشورة
            url: `/marketplace/services/${service.slug}`,
          },
          // تأكيد الشهادة المستخدَمة — يُعزِّز ثقة المستخدم بالنظام
          verifiedWith: {
            courseId,
            courseName: course.title,
            credentialId: permissions.certificates.find(
              (c) => c.courseId === courseId
            )?.credentialId,
          },
          message: "🎉 تمّ نشر خدمتك بنجاح! يمكن للعملاء الآن اكتشافها في السوق.",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PUBLISH_SERVICE_HANDLER]", error);
    return createErrorResponse("POLICY_VIOLATION", 500, {
      message: "حدث خطأ غير متوقَّع أثناء نشر الخدمة. يُرجى المحاولة مجدّداً.",
    });
  }
}

// ─── Route Export ─────────────────────────────────────────────────────────────
// withAuth يُغلِّف Handler ويضمن اكتمال سلسلة التحقّق قبل الوصول إليه
export const POST = withAuth(publishServiceHandler, {
  allowedRoles: ["CREATOR", "ADMIN"],
  loadCertificates: true,   // مطلوب لـ PolicyEngine.canPublishService()
  adminBypass: true,        // Admin يتجاوز قيد الدور لكن ليس قيد الـ Zod
});

// Block all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return createErrorResponse("POLICY_VIOLATION", 405, {
    message: "هذا المسار يقبل طلبات POST فقط.",
  });
}