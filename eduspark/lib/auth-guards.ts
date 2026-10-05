// ============================================================================
// نظام ABAC الكامل — المحرّك الأمني الرئيسي لمنصة EduSpark
//
// هذا الملف يحتوي على:
// 1. withAuth() — HOF للتحقّق من الجلسة وتحميل الصلاحيات
// 2. loadUserPermissions() — جلب الشهادات وبناء كائن الصلاحيات
// 3. PolicyEngine — مجموعة دوال التحقّق من كل سياسة أعمالية
// 4. createPolicyViolationResponse() — استجابة 403 موحَّدة ومفصَّلة
// ============================================================================

import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import type {
  UserPermissions,
  CertificateInfo,
  AuthorizationDecision,
  GuardOptions,
  AuthDenialReason,
} from "@/types/auth";
import type { Role } from "@prisma/client";

// ============================================================================
// LAYER 1: Session Loading & JWT Verification
// الطبقة الأولى: تحميل الجلسة والتحقّق من الـ JWT
// ============================================================================

/**
 * يُحمِّل الجلسة الحالية من NextAuth ويُعيد بيانات المستخدم الأساسية.
 * NextAuth تتولّى التحقّق من صحة الـ JWT تلقائياً عبر NEXTAUTH_SECRET.
 */
async function getCurrentSession(): Promise<{
  userId: string;
  role: Role;
  email: string;
  name: string;
} | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

// ============================================================================
// LAYER 2: Permission Loading from Database
// الطبقة الثانية: تحميل الصلاحيات الديناميكية من قاعدة البيانات
// ============================================================================

/**
 * يُحمِّل الصلاحيات الكاملة للمستخدم بما فيها الشهادات المُكتسَبة.
 *
 * لماذا نستعلم DB هنا وليس من الـ JWT؟
 * الشهادات بيانات متغيّرة وحجمها غير محدود.
 * تخزينها في الـ JWT سيُضخِّمه، وإذا أُلغيت شهادة (حالة نادرة لكن ممكنة)
 * سيبقى الـ JWT القديم يحملها حتى انتهاء صلاحيته.
 * الاستعلام من DB يضمن دقّة المعلومات في كل طلب.
 */
async function loadUserPermissions(
  userId: string,
  role: Role,
  email: string,
  name: string
): Promise<UserPermissions | null> {
  // استعلام واحد مُحسَّن يجلب كل البيانات دفعة واحدة
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      reputationScore: true,
      certificates: {
        select: {
          id: true,
          credentialId: true,
          courseId: true,
          score: true,
          issuedAt: true,
          course: {
            select: {
              title: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        // نُرتِّب بالأحدث أوّلاً لأن الواجهة ستعرضهم بهذا الترتيب غالباً
        orderBy: { issuedAt: "desc" },
      },
    },
  });

  if (!user) return null;

  // تحويل بيانات الـ DB إلى الهيكل المُعرَّف في types/auth.ts
  const certificates: CertificateInfo[] = user.certificates.map((cert) => ({
    id: cert.id,
    credentialId: cert.credentialId,
    courseId: cert.courseId,
    categoryId: cert.course.category?.id ?? null,
    score: cert.score,
    issuedAt: cert.issuedAt,
    courseName: cert.course.title,
    categoryName: cert.course.category?.name ?? null,
    categorySlug: cert.course.category?.slug ?? null,
  }));

  // بناء مجموعات فهرسة O(1) للتحقّق السريع
  const certifiedCourseIds = new Set(certificates.map((c) => c.courseId));
  const certifiedCategoryIds = new Set(
    certificates
      .map((c) => c.categoryId)
      .filter((id): id is string => id !== null)
  );

  return {
    userId,
    email,
    name,
    role,
    certificates,
    certifiedCourseIds,
    certifiedCategoryIds,
    isActive: user.isActive,
    reputationScore: user.reputationScore,
  };
}

// ============================================================================
// LAYER 3: Policy Engine
// الطبقة الثالثة: محرّك السياسات — كل دالة تُجسِّد قاعدة أعمالية من BRS v1.0
// ============================================================================

export const PolicyEngine = {
  // --------------------------------------------------------------------------
  // AG-01: Certificate-Gated Service Publication
  // المستقل لا يستطيع نشر خدمة في فئة إلا إذا امتلك شهادة للمقرّر المرتبط بها
  // --------------------------------------------------------------------------
  canPublishService(
    permissions: UserPermissions,
    targetCourseId: string
  ): AuthorizationDecision {
    // الحارس الأوّل: الدور
    if (permissions.role !== "CREATOR" && permissions.role !== "ADMIN") {
      return {
        granted: false,
        reason: "INSUFFICIENT_ROLE",
        message:
          "يجب أن تجتاز اختبار شهادة مقرّر أوّلاً لتصبح مستقلاً موثَّقاً قادراً على نشر الخدمات.",
        metadata: { requiredRole: "CREATOR", currentRole: permissions.role },
      };
    }

    // Admin bypass: المشرف يستطيع نشر أي خدمة
    if (permissions.role === "ADMIN") {
      return { granted: true };
    }

    // الحارس الثاني: الشهادة
    if (!permissions.certifiedCourseIds.has(targetCourseId)) {
      // نجلب اسم المقرّر لتقديم رسالة خطأ مفيدة
      const missingCourse = permissions.certificates.find(
        () => false // لن نجده — هذا للتوضيح
      );

      return {
        granted: false,
        reason: "MISSING_CERTIFICATE",
        message:
          "لا تمتلك الشهادة المطلوبة لنشر خدمة في هذه الفئة. أكمل المقرّر المرتبط واجتز اختباره بنسبة 80% أو أعلى.",
        metadata: {
          requiredCourseId: targetCourseId,
          yourCertificates: permissions.certificates.map((c) => ({
            courseId: c.courseId,
            courseName: c.courseName,
            score: c.score,
          })),
        },
      };
    }

    return { granted: true };
  },

  // --------------------------------------------------------------------------
  // AG-02a: Self-Order Prevention
  // العميل لا يستطيع شراء خدمته الخاصة
  // --------------------------------------------------------------------------
  canOrderService(
    permissions: UserPermissions,
    serviceCreatorId: string
  ): AuthorizationDecision {
    if (permissions.userId === serviceCreatorId) {
      return {
        granted: false,
        reason: "SELF_ACTION_FORBIDDEN",
        message: "لا يمكنك شراء خدمتك الخاصة.",
        metadata: { selfOrderAttempt: true },
      };
    }

    return { granted: true };
  },

  // --------------------------------------------------------------------------
  // AG-02b: Self-Approval Prevention
  // المستقل لا يستطيع اعتماد مشروعه ذاتياً
  // --------------------------------------------------------------------------
  canApproveProject(
    permissions: UserPermissions,
    project: { clientId: string; creatorId: string }
  ): AuthorizationDecision {
    if (permissions.userId !== project.clientId) {
      return {
        granted: false,
        reason: "SELF_ACTION_FORBIDDEN",
        message:
          "فقط العميل صاحب المشروع يستطيع اعتماد التسليم. المستقل لا يستطيع تقييم عمله الخاص.",
        metadata: {
          requiredUserId: project.clientId,
          requestingUserId: permissions.userId,
        },
      };
    }

    return { granted: true };
  },

  // --------------------------------------------------------------------------
  // AG-03: Course Chat Room Access
  // الوصول لغرفة الدراسة يتطلّب تسجيلاً نشطاً في المقرّر
  // --------------------------------------------------------------------------
  async canAccessCourseChat(
    permissions: UserPermissions,
    courseId: string
  ): Promise<AuthorizationDecision> {
    // المنشئ أو Admin يستطيع الدخول دائماً
    if (permissions.role === "ADMIN") return { granted: true };

    // تحقّق الـ enrollment من DB لأن هذه بيانات لم نُحمِّلها في permissions
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: permissions.userId,
          courseId,
        },
      },
      select: { status: true },
    });

    // المدرِّس يستطيع الدخول لغرفة مقرّره
    const isCourseInstructor = await db.course
      .findFirst({
        where: { id: courseId, instructorId: permissions.userId },
        select: { id: true },
      })
      .then(Boolean);

    if (isCourseInstructor) return { granted: true };

    if (!enrollment || enrollment.status === "CANCELLED") {
      return {
        granted: false,
        reason: "POLICY_VIOLATION",
        message:
          "غرفة الدراسة متاحة للطلاب المسجَّلين في هذا المقرّر فقط.",
        metadata: { courseId },
      };
    }

    return { granted: true };
  },

  // --------------------------------------------------------------------------
  // AG-03b: Project Chat Room Access
  // الوصول يقتصر على العميل والمستقل المرتبطَين بالمشروع
  // --------------------------------------------------------------------------
  canAccessProjectChat(
    permissions: UserPermissions,
    project: { clientId: string; creatorId: string }
  ): AuthorizationDecision {
    const isParticipant =
      permissions.userId === project.clientId ||
      permissions.userId === project.creatorId;

    if (!isParticipant && permissions.role !== "ADMIN") {
      return {
        granted: false,
        reason: "POLICY_VIOLATION",
        message:
          "هذه الغرفة خاصة بطرفَي المشروع فقط — العميل والمستقل المُعيَّن.",
        metadata: {
          projectClientId: project.clientId,
          projectCreatorId: project.creatorId,
          requestingUserId: permissions.userId,
        },
      };
    }

    return { granted: true };
  },

  // --------------------------------------------------------------------------
  // AG-04: Milestone Execution Guards
  // --------------------------------------------------------------------------
  canStartMilestone(
    permissions: UserPermissions,
    project: { creatorId: string }
  ): AuthorizationDecision {
    if (
      permissions.userId !== project.creatorId &&
      permissions.role !== "ADMIN"
    ) {
      return {
        granted: false,
        reason: "INSUFFICIENT_ROLE",
        message: "فقط المستقل المُعيَّن يستطيع بدء العمل على المعالم.",
      };
    }
    return { granted: true };
  },

  canRequestRevision(
    permissions: UserPermissions,
    project: { clientId: string }
  ): AuthorizationDecision {
    if (
      permissions.userId !== project.clientId &&
      permissions.role !== "ADMIN"
    ) {
      return {
        granted: false,
        reason: "SELF_ACTION_FORBIDDEN",
        message: "فقط العميل يستطيع طلب مراجعة على المعالم المُقدَّمة.",
      };
    }
    return { granted: true };
  },
} as const;

// ============================================================================
// LAYER 4: Higher-Order Guard Functions
// الطبقة الرابعة: دوال الـ Guard المُغلِّفة للـ Route Handlers
// ============================================================================

// نوع الـ Route Handler الذي يستقبل UserPermissions
type AuthenticatedHandler<TBody = unknown> = (
  req: NextRequest,
  permissions: UserPermissions,
  body: TBody
) => Promise<NextResponse>;

/**
 * withAuth: Higher-Order Function للـ Route Handlers
 *
 * يتولّى:
 * 1. التحقّق من وجود جلسة صالحة
 * 2. التحقّق من الدور المطلوب
 * 3. تحميل الشهادات والصلاحيات الكاملة
 * 4. تمرير كائن UserPermissions للـ Handler
 *
 * استخدام:
 *   export const POST = withAuth(handler, { allowedRoles: ["CREATOR"] });
 */
export function withAuth<TBody = unknown>(
  handler: AuthenticatedHandler<TBody>,
  options: GuardOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const {
    allowedRoles = [],
    loadCertificates = true,
    adminBypass = true,
  } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    // ── Step 1: جلب الجلسة والتحقّق من المصادقة ─────────────────────────
    const sessionData = await getCurrentSession();

    if (!sessionData) {
      return createErrorResponse("UNAUTHENTICATED", 401, {
        message: "يجب تسجيل الدخول للوصول لهذه الخدمة.",
      });
    }

    // ── Step 2: التحقّق من الدور (قبل تحميل الـ DB لتوفير الاستعلامات) ──
    const isAdminBypass = adminBypass && sessionData.role === "ADMIN";

    if (allowedRoles.length > 0 && !isAdminBypass) {
      if (!allowedRoles.includes(sessionData.role)) {
        return createErrorResponse("INSUFFICIENT_ROLE", 403, {
          message: `هذه الخدمة تتطلّب أحد الأدوار التالية: ${allowedRoles.join(", ")}.`,
          metadata: {
            requiredRoles: allowedRoles,
            currentRole: sessionData.role,
          },
        });
      }
    }

    // ── Step 3: تحميل الصلاحيات الكاملة من قاعدة البيانات ────────────────
    let permissions: UserPermissions;

    if (loadCertificates) {
      const loaded = await loadUserPermissions(
        sessionData.userId,
        sessionData.role,
        sessionData.email,
        sessionData.name
      );

      if (!loaded) {
        return createErrorResponse("UNAUTHENTICATED", 401, {
          message: "تعذَّر تحميل بيانات المستخدم. يُرجى تسجيل الدخول مجدّداً.",
        });
      }

      // التحقّق من أن الحساب لم يُعطَّل بعد إصدار الـ JWT
      if (!loaded.isActive) {
        return createErrorResponse("ACCOUNT_DISABLED", 403, {
          message: "حسابك موقوف حالياً. يُرجى التواصل مع الدعم الفني.",
        });
      }

      permissions = loaded;
    } else {
      // نسخة خفيفة بدون شهادات للمسارات البسيطة
      permissions = {
        userId: sessionData.userId,
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role,
        certificates: [],
        certifiedCourseIds: new Set(),
        certifiedCategoryIds: new Set(),
        isActive: true,
        reputationScore: 0,
      };
    }

    // ── Step 4: قراءة وتحليل الـ Request Body ────────────────────────────
    let body: TBody;
    try {
      // بعض الطلبات قد لا تحتوي body (مثل DELETE)
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        body = await req.json();
      } else {
        body = {} as TBody;
      }
    } catch {
      return createErrorResponse("POLICY_VIOLATION", 400, {
        message: "صيغة الطلب غير صحيحة. يُرجى إرسال JSON صالح.",
      });
    }

    // ── Step 5: تمرير التحكّم للـ Handler الأصلي ─────────────────────────
    return handler(req, permissions, body);
  };
}

/**
 * withAuthAction: نسخة Server Actions (بدون NextRequest/Response)
 *
 * تُستخدَم في "use server" functions مباشرة.
 * تُعيد UserPermissions أو null إن فشل التحقّق.
 */
export async function withAuthAction(
  options: GuardOptions = {}
): Promise<UserPermissions | null> {
  const { allowedRoles = [], loadCertificates = true } = options;

  const sessionData = await getCurrentSession();
  if (!sessionData) return null;

  if (allowedRoles.length > 0 && sessionData.role !== "ADMIN") {
    if (!allowedRoles.includes(sessionData.role)) return null;
  }

  if (!loadCertificates) {
    return {
      userId: sessionData.userId,
      email: sessionData.email,
      name: sessionData.name,
      role: sessionData.role,
      certificates: [],
      certifiedCourseIds: new Set(),
      certifiedCategoryIds: new Set(),
      isActive: true,
      reputationScore: 0,
    };
  }

  const permissions = await loadUserPermissions(
    sessionData.userId,
    sessionData.role,
    sessionData.email,
    sessionData.name
  );

  if (!permissions?.isActive) return null;

  return permissions;
}

// ============================================================================
// LAYER 5: Response Utilities
// الطبقة الخامسة: أدوات بناء الاستجابات المعيارية
// ============================================================================

/**
 * الاستجابة المعيارية للخطأ الأمني
 * كل رفض يأتي بنفس الهيكل ليسهل التعامل معه في الواجهة
 */
export function createErrorResponse(
  reason: AuthDenialReason | string,
  statusCode: 400 | 401 | 403 | 404 | 429 | 500,
  options: {
    message: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
  }
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        reason,
        message: options.message,
        timestamp: new Date().toISOString(),
        // لا نُكشِف تفاصيل البنية الداخلية في production
        ...(process.env.NODE_ENV !== "production" && options.metadata
          ? { debug: options.metadata }
          : {}),
      },
    },
    { status: statusCode }
  );
}

/**
 * تحويل AuthorizationDecision إلى NextResponse
 */
export function enforceDecision(
  decision: AuthorizationDecision,
  statusCode: 400 | 401 | 403 | 404 | 429 | 500 = 403
): NextResponse | null {
  if (decision.granted) return null; // null = مسموح، تابع التنفيذ

  return createErrorResponse(decision.reason, statusCode, {
    message: decision.message,
    metadata: decision.metadata,
  });
}