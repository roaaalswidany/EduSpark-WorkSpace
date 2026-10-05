// ============================================================================
// نظام سجلّات التدقيق الآمنة — EduSpark Audit Trail
//
// هذا الملف مسؤول حصراً عن:
// 1. تعريف كل الأحداث القابلة للتدقيق (AUDITABLE_EVENTS)
// 2. كتابة سجلّات تدقيق موقَّعة تشفيرياً (HMAC-SHA256)
// 3. التحقّق من سلامة السجلّات لاحقاً (verifyAuditLog)
//
// مبدأ عدم القابلية للإنكار (Non-Repudiation):
// كل سجلّ مُوقَّع بـ HMAC يستخدم مفتاحاً سرياً (AUDIT_HMAC_SECRET).
// هذا يعني أنه يمكن إثبات أن هذا السجلّ نشأ من هذا النظام وحده،
// ولم يتمّ تعديله بعد كتابته.
// ============================================================================

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

// ─── الثوابت ─────────────────────────────────────────────────────────────────

const LOG_DIR = path.resolve(process.cwd(), "logs");
const AUDIT_LOG_DIR = path.join(LOG_DIR, "audit");

// مجلّد تدقيق منفصل بأذونات مقيَّدة جداً
if (!fs.existsSync(AUDIT_LOG_DIR)) {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true, mode: 0o700 });
  // 0o700: المالك فقط يقرأ/يكتب/ينفّذ — لا أحد غيره
}

const AUDIT_HMAC_SECRET =
  process.env["AUDIT_HMAC_SECRET"] ??
  (() => {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "FATAL: AUDIT_HMAC_SECRET must be set in production. " +
        "Generate with: openssl rand -hex 32"
      );
    }
    // في التطوير: نستخدم مفتاحاً افتراضياً مع تحذير
    logger.warn(
      "AUDIT_HMAC_SECRET not set. Using insecure default for development only."
    );
    return "dev-only-insecure-hmac-secret-do-not-use-in-production";
  })();

// ─── تعريف الأحداث القابلة للتدقيق ──────────────────────────────────────────

// كل حدث يجب أن يكون موثَّقاً هنا — لا أحداث مجهولة في سجلّ التدقيق
export const AUDITABLE_EVENTS = {
  // ── المصادقة ──────────────────────────────────────────────────────────────
  AUTH_REGISTER:                "AUTH.REGISTER",
  AUTH_LOGIN_SUCCESS:           "AUTH.LOGIN.SUCCESS",
  AUTH_LOGIN_FAILED:            "AUTH.LOGIN.FAILED",
  AUTH_LOGOUT:                  "AUTH.LOGOUT",
  AUTH_PASSWORD_CHANGED:        "AUTH.PASSWORD.CHANGED",
  AUTH_ACCOUNT_DISABLED:        "AUTH.ACCOUNT.DISABLED",

  // ── الاختبارات والشهادات ──────────────────────────────────────────────────
  QUIZ_SUBMITTED:               "QUIZ.SUBMITTED",
  QUIZ_PASSED:                  "QUIZ.PASSED",
  QUIZ_FAILED:                  "QUIZ.FAILED",
  CERTIFICATE_ISSUED:           "CERTIFICATE.ISSUED",
  CERTIFICATE_VERIFIED:         "CERTIFICATE.VERIFIED",
  CERTIFICATE_REVOKED:          "CERTIFICATE.REVOKED",

  // ── ترقية الأدوار ─────────────────────────────────────────────────────────
  ROLE_UPGRADED:                "ROLE.UPGRADED",
  ROLE_DOWNGRADED:              "ROLE.DOWNGRADED",
  ROLE_UPGRADE_DENIED:          "ROLE.UPGRADE.DENIED",

  // ── الخدمات والسوق ────────────────────────────────────────────────────────
  SERVICE_PUBLISHED:            "SERVICE.PUBLISHED",
  SERVICE_PAUSED:               "SERVICE.PAUSED",
  SERVICE_PUBLISH_DENIED:       "SERVICE.PUBLISH.DENIED",

  // ── المشاريع والمعاملات ───────────────────────────────────────────────────
  PROJECT_CREATED:              "PROJECT.CREATED",
  PROJECT_STATUS_CHANGED:       "PROJECT.STATUS.CHANGED",
  MILESTONE_STATUS_CHANGED:     "MILESTONE.STATUS.CHANGED",
  PROJECT_COMPLETED:            "PROJECT.COMPLETED",
  PROJECT_DISPUTED:             "PROJECT.DISPUTED",
  PROJECT_DISPUTE_RESOLVED:     "PROJECT.DISPUTE.RESOLVED",

  // ── الأمان ────────────────────────────────────────────────────────────────
  UNAUTHORIZED_ACCESS_ATTEMPT:  "SECURITY.UNAUTHORIZED.ACCESS",
  RATE_LIMIT_EXCEEDED:          "SECURITY.RATE_LIMIT.EXCEEDED",
  SUSPICIOUS_ACTIVITY:          "SECURITY.SUSPICIOUS.ACTIVITY",
  JWT_VALIDATION_FAILED:        "SECURITY.JWT.VALIDATION.FAILED",
  ABAC_POLICY_DENIED:           "SECURITY.ABAC.POLICY.DENIED",

  // ── الإدارة ───────────────────────────────────────────────────────────────
  ADMIN_ACTION:                 "ADMIN.ACTION",
  DATA_EXPORT:                  "ADMIN.DATA.EXPORT",
  USER_IMPERSONATED:            "ADMIN.USER.IMPERSONATED",
} as const;

export type AuditableEvent = typeof AUDITABLE_EVENTS[keyof typeof AUDITABLE_EVENTS];

// ─── نوع حدث التدقيق ─────────────────────────────────────────────────────────

export type AuditStatus = "SUCCESS" | "FAILURE" | "DENIED" | "PENDING";

export interface AuditEventData {
  // الجهة الفاعلة
  actorId: string;             // User.id الذي نفَّذ الحدث
  actorRole?: string;          // دوره وقت الحدث

  // الحدث
  action: AuditableEvent;      // نوع الحدث من AUDITABLE_EVENTS
  status: AuditStatus;         // نتيجة العملية

  // الهدف (اختياري)
  targetId?: string;           // معرّف الكيان المتأثَّر (مثل projectId, courseId)
  targetType?: string;         // نوع الكيان ("Project" | "Certificate" | إلخ)

  // التفاصيل
  details?: Record<string, unknown>;  // بيانات إضافية مفيدة

  // السياق التقني
  ipAddress?: string;          // عنوان IP المُرسِل
  userAgent?: string;          // متصفّح أو عميل الطلب
  requestId?: string;          // معرّف الطلب للتتبّع
  sessionId?: string;          // معرّف الجلسة

  // الوقت (اختياري — نُضيفه تلقائياً)
  timestamp?: string;
}

// ─── السجلّ الكامل المُوقَّع ──────────────────────────────────────────────────

interface SignedAuditRecord {
  version: "1.0";              // إصدار صيغة السجلّ للتوافق المستقبلي
  id: string;                  // معرّف فريد لهذا السجلّ
  timestamp: string;           // ISO 8601 بمنطقة UTC
  data: AuditEventData;        // البيانات الأصلية
  checksum: string;            // HMAC-SHA256 للتحقّق من عدم التلاعب
  previousChecksum?: string;   // ربط السجلّات (Blockchain-like chain)
}

// ─── متغيّر global للـ Checksum الأخير ──────────────────────────────────────
// يُربَط كل سجلّ بالسابق لإنشاء سلسلة غير قابلة للتلاعب
let lastChecksum: string = "GENESIS"; // قيمة البداية

// ─── Logger مخصَّص لسجلّات التدقيق ──────────────────────────────────────────

const auditWinstonLogger = winston.createLogger({
  level: "audit",
  levels: { audit: 0 },
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
    winston.format.json()
  ),
  transports: [
    // ملف تدقيق يومي — لا يُضغَط لسهولة الفحص القانوني
    new DailyRotateFile({
      filename: path.join(AUDIT_LOG_DIR, "audit-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
      maxFiles: "2555d",      // 7 سنوات — المعيار القانوني في كثير من الدول
      zippedArchive: false,   // لا ضغط — السجلّات القانونية يجب أن تبقى قابلة للقراءة الفورية
      auditFile: path.join(AUDIT_LOG_DIR, ".rotation-audit.json"),
    }),
  ],
  exitOnError: false,
});

// ─── دالة توليد التوقيع التشفيري ─────────────────────────────────────────────

function generateChecksum(data: string, previousChecksum: string): string {
  // ندمج البيانات مع الـ checksum السابق لإنشاء سلسلة
  const payload = `${previousChecksum}:${data}`;
  return crypto
    .createHmac("sha256", AUDIT_HMAC_SECRET)
    .update(payload, "utf8")
    .digest("hex");
}

// ─── الدالة الرئيسية: logAuditEvent ──────────────────────────────────────────

/**
 * تُسجِّل حدث تدقيق موقَّعاً تشفيرياً
 *
 * @param actorId    معرّف المستخدم الذي نفَّذ الحدث
 * @param action     نوع الحدث من AUDITABLE_EVENTS
 * @param targetId   معرّف الكيان المتأثَّر (اختياري)
 * @param status     نتيجة العملية
 * @param details    بيانات إضافية مفيدة للتحقيق
 */
export async function logAuditEvent(
  actorId: string,
  action: AuditableEvent,
  targetId: string | null,
  status: AuditStatus,
  details?: AuditEventData["details"] & {
    actorRole?: string;
    targetType?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
  }
): Promise<string> {
  const timestamp = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const eventData: AuditEventData = {
    actorId,
    actorRole: details?.actorRole,
    action,
    status,
    ...(targetId ? { targetId } : {}),
    ...(details?.targetType ? { targetType: details.targetType } : {}),
    details: sanitizeDetails(details),
    ipAddress: details?.ipAddress,
    userAgent: details?.userAgent,
    requestId: details?.requestId,
    sessionId: details?.sessionId,
    timestamp,
  };

  // بناء السجلّ الكامل
  const recordData = JSON.stringify({
    id: eventId,
    timestamp,
    data: eventData,
  });

  // توليد التوقيع المرتبط بالسابق
  const checksum = generateChecksum(recordData, lastChecksum);

  const signedRecord: SignedAuditRecord = {
    version: "1.0",
    id: eventId,
    timestamp,
    data: eventData,
    checksum,
    previousChecksum: lastChecksum,
  };

  // تحديث الـ checksum الأخير
  lastChecksum = checksum;

  // الكتابة في ملف التدقيق
  auditWinstonLogger.log("audit", JSON.stringify(signedRecord));

  // كتابة ملخَّص في سجلّ التطبيق الرئيسي أيضاً (بدون بيانات حسّاسة)
  logger.info(`AUDIT: ${action}`, {
    eventId,
    actorId,
    action,
    status,
    targetId: targetId ?? undefined,
  });

  // في حالات الفشل الأمني: سجِّل في stderr مباشرة كحارس احتياطي
  if (status === "DENIED" || status === "FAILURE") {
    if (
      action.startsWith("SECURITY.") ||
      action === AUDITABLE_EVENTS.AUTH_LOGIN_FAILED ||
      action === AUDITABLE_EVENTS.ROLE_UPGRADE_DENIED
    ) {
      process.stderr.write(
        JSON.stringify({
          SECURITY_EVENT: true,
          eventId,
          action,
          actorId,
          status,
          timestamp,
        }) + "\n"
      );
    }
  }

  return eventId;
}

// ─── تنظيف البيانات الحسّاسة ─────────────────────────────────────────────────

function sanitizeDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined;

  // قائمة الحقول المحظور تسجيلها في أي ظرف
  const FORBIDDEN_FIELDS = new Set([
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "secret",
    "privateKey",
    "creditCard",
    "cvv",
    "ssn",
    "nationalId",
    // ... يمكن الإضافة حسب احتياجات المشروع
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    // تخطّي المفاتيح المحظورة
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // تخطّي حقول السياق التي نُعالجها بشكل منفصل
    if (["actorRole", "targetType", "ipAddress", "userAgent", "requestId", "sessionId"].includes(key)) {
      continue;
    }

    // تسطيح القيم المعقّدة بأمان
    if (typeof value === "object" && value !== null) {
      sanitized[key] = JSON.parse(JSON.stringify(value)); // deep clone آمن
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ─── التحقّق من سلامة سجلّات التدقيق ────────────────────────────────────────

export interface AuditVerificationResult {
  totalRecords: number;
  validRecords: number;
  tamperedRecords: Array<{
    id: string;
    timestamp: string;
    reason: string;
  }>;
  chainBroken: boolean;
  chainBreakAt?: string;
}

/**
 * يتحقّق من سلامة ملف سجلّات التدقيق
 * يُستخدَم للتدقيق الدوري أو عند الاشتباه في تلاعب
 *
 * @param logFilePath مسار ملف السجلّات للتحقّق
 */
export async function verifyAuditLogIntegrity(
  logFilePath: string
): Promise<AuditVerificationResult> {
  const result: AuditVerificationResult = {
    totalRecords: 0,
    validRecords: 0,
    tamperedRecords: [],
    chainBroken: false,
  };

  if (!fs.existsSync(logFilePath)) {
    throw new Error(`Audit log file not found: ${logFilePath}`);
  }

  const content = fs.readFileSync(logFilePath, "utf8");
  const lines = content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        // Winston يُغلِّف الرسالة في { message: ... }
        const innerStr = parsed["message"] ?? line;
        return typeof innerStr === "string" ? JSON.parse(innerStr) : innerStr;
      } catch {
        return null;
      }
    })
    .filter((record): record is SignedAuditRecord => record !== null);

  result.totalRecords = lines.length;

  let previousChecksum = "GENESIS";

  for (const record of lines) {
    try {
      // إعادة بناء البيانات التي كانت تُوقَّع
      const recordData = JSON.stringify({
        id: record.id,
        timestamp: record.timestamp,
        data: record.data,
      });

      // إعادة حساب الـ checksum
      const expectedChecksum = generateChecksum(recordData, previousChecksum);

      if (record.checksum !== expectedChecksum) {
        result.tamperedRecords.push({
          id: record.id,
          timestamp: record.timestamp,
          reason: "Checksum mismatch — record may have been modified",
        });

        if (!result.chainBroken) {
          result.chainBroken = true;
          result.chainBreakAt = record.id;
        }
      } else {
        result.validRecords++;
      }

      previousChecksum = record.checksum;
    } catch (error) {
      result.tamperedRecords.push({
        id: record.id ?? "unknown",
        timestamp: record.timestamp ?? "unknown",
        reason: `Verification error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  }

  return result;
}

// ─── دوال مساعدة للأحداث الشائعة ─────────────────────────────────────────────

// هذه الدوال تُبسِّط الاستخدام في Service Actions

export const auditHelpers = {
  /**
   * تسجيل نجاح ترقية الدور
   */
  roleUpgraded: (params: {
    userId: string;
    fromRole: string;
    toRole: string;
    courseId: string;
    certificateId: string;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.userId,
      AUDITABLE_EVENTS.ROLE_UPGRADED,
      params.userId,
      "SUCCESS",
      {
        fromRole: params.fromRole,
        toRole: params.toRole,
        courseId: params.courseId,
        certificateId: params.certificateId,
        targetType: "User",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل إصدار شهادة
   */
  certificateIssued: (params: {
    userId: string;
    courseId: string;
    certificateId: string;
    credentialId: string;
    score: number;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.userId,
      AUDITABLE_EVENTS.CERTIFICATE_ISSUED,
      params.certificateId,
      "SUCCESS",
      {
        courseId: params.courseId,
        credentialId: params.credentialId,
        score: params.score,
        targetType: "Certificate",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل تقديم اختبار
   */
  quizSubmitted: (params: {
    userId: string;
    quizId: string;
    courseId: string;
    score: number;
    passed: boolean;
    attemptNumber: number;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.userId,
      params.passed ? AUDITABLE_EVENTS.QUIZ_PASSED : AUDITABLE_EVENTS.QUIZ_FAILED,
      params.quizId,
      params.passed ? "SUCCESS" : "FAILURE",
      {
        courseId: params.courseId,
        score: params.score,
        passed: params.passed,
        attemptNumber: params.attemptNumber,
        targetType: "Quiz",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل رفض نشر خدمة
   */
  servicePublishDenied: (params: {
    userId: string;
    courseId: string;
    reason: string;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.userId,
      AUDITABLE_EVENTS.SERVICE_PUBLISH_DENIED,
      params.courseId,
      "DENIED",
      {
        reason: params.reason,
        courseId: params.courseId,
        targetType: "Service",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل اكتمال مشروع
   */
  projectCompleted: (params: {
    clientId: string;
    projectId: string;
    creatorId: string;
    amount: number;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.clientId,
      AUDITABLE_EVENTS.PROJECT_COMPLETED,
      params.projectId,
      "SUCCESS",
      {
        creatorId: params.creatorId,
        amount: params.amount,
        targetType: "Project",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل محاولة وصول غير مخوَّل
   */
  unauthorizedAccess: (params: {
    userId: string;
    resource: string;
    action: string;
    ipAddress?: string;
    reason?: string;
  }) =>
    logAuditEvent(
      params.userId,
      AUDITABLE_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT,
      params.resource,
      "DENIED",
      {
        attemptedAction: params.action,
        reason: params.reason,
        targetType: "Resource",
        ipAddress: params.ipAddress,
      }
    ),

  /**
   * تسجيل تجاوز حدّ المعدّل
   */
  rateLimitExceeded: (params: {
    userId: string;
    endpoint: string;
    limit: number;
    windowSeconds: number;
    ipAddress?: string;
  }) =>
    logAuditEvent(
      params.userId,
      AUDITABLE_EVENTS.RATE_LIMIT_EXCEEDED,
      params.endpoint,
      "DENIED",
      {
        endpoint: params.endpoint,
        limit: params.limit,
        windowSeconds: params.windowSeconds,
        targetType: "Endpoint",
        ipAddress: params.ipAddress,
      }
    ),
};