// ============================================================================
// EduSpark Centralized Logging System
//
// البنية:
// ┌─────────────────────────────────────────────────────────┐
// │                    Logger Factory                        │
// │                                                         │
// │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
// │  │  Console  │  │  App     │  │  Error   │  │ Audit  │ │
// │  │ (pretty) │  │  File    │  │  File    │  │  File  │ │
// │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
// └─────────────────────────────────────────────────────────┘
//
// مستويات السجلّات المخصَّصة:
//   0: AUDIT  ← أعلى أولوية — قرارات الأعمال الحرجة
//   1: ERROR  ← أخطاء تمنع تشغيل وظيفة
//   2: WARN   ← أحداث مقلقة لا تمنع التشغيل
//   3: INFO   ← معلومات تشغيلية عامة
//   4: HTTP   ← طلبات HTTP الواردة
//   5: DEBUG  ← تفاصيل للتطوير فقط
// ============================================================================

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import os from "os";

// ─── مجلّد السجلّات ───────────────────────────────────────────────────────────
const LOG_DIR = path.resolve(process.cwd(), "logs");

// إنشاء المجلّد إن لم يكن موجوداً، مع أذونات مقيَّدة
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o750 });
  // 0o750: المالك يقرأ/يكتب/ينفّذ، المجموعة تقرأ/تنفّذ، الباقون لا صلاحيات
}

// ─── المستويات المخصَّصة ─────────────────────────────────────────────────────
// أرقام أصغر = أولوية أعلى
const CUSTOM_LEVELS = {
  levels: {
    audit: 0,  // أحداث التدقيق الحرجة — لا تُحذَف أبداً
    error: 1,  // أخطاء النظام
    warn: 2,   // تحذيرات
    info: 3,   // معلومات تشغيلية
    http: 4,   // سجلّ طلبات HTTP
    debug: 5,  // تفاصيل التطوير
  },
  colors: {
    audit: "magenta bold",
    error: "red bold",
    warn: "yellow",
    info: "green",
    http: "cyan",
    debug: "white",
  },
} as const;

winston.addColors(CUSTOM_LEVELS.colors);

// ─── تنسيق البيانات الأساسي ──────────────────────────────────────────────────

// معلومات السياق المُضافة لكل سجلّ
const systemContext = {
  hostname: os.hostname(),
  pid: process.pid,
  service: process.env["SERVICE_NAME"] ?? "eduspark-api",
  environment: process.env["NODE_ENV"] ?? "development",
  version: process.env["npm_package_version"] ?? "unknown",
};

// تنسيق JSON المنظَّم للملفات
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  // إضافة السياق الثابت لكل سجلّ
  winston.format((info) => {
    return { ...systemContext, ...info };
  })()
);

// تنسيق بشري مقروء للكونسول
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")}`
      : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// ─── إعداد الـ Transports ────────────────────────────────────────────────────

// 1. Console Transport — للتطوير المحلي
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  // في الإنتاج: عرض WARN فأعلى فقط لتجنّب إغراق stdout
  level: process.env["NODE_ENV"] === "production" ? "warn" : "debug",
});

// 2. Application Logs — تدوير يومي، احتفاظ 30 يوماً
const appFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",          // 20 ميجابايت كحدّ أقصى لكل ملف
  maxFiles: "30d",          // احتفاظ 30 يوماً
  level: "debug",
  format: jsonFormat,
  zippedArchive: true,      // ضغط الملفات المُؤرشَفة
  createSymlink: true,
  symlinkName: "app-current.log", // رابط للملف الحالي
  // حدث عند إنشاء ملف جديد
  auditFile: path.join(LOG_DIR, ".app-audit.json"),
});

// 3. Error Logs — ملف منفصل للأخطاء فقط، احتفاظ 90 يوماً
const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "10m",
  maxFiles: "90d",          // الأخطاء تُحفَظ لفترة أطول
  level: "error",
  format: jsonFormat,
  zippedArchive: true,
  auditFile: path.join(LOG_DIR, ".error-audit.json"),
});

// 4. HTTP Logs — سجلّ طلبات HTTP منفصل
const httpFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "http-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "50m",
  maxFiles: "14d",          // أسبوعان فقط — حجم كبير وأهمية أقل
  level: "http",
  format: jsonFormat,
  zippedArchive: true,
  auditFile: path.join(LOG_DIR, ".http-audit.json"),
});

// ─── Logger الرئيسي ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  levels: CUSTOM_LEVELS.levels,
  level: "debug", // المستوى الأدنى الذي يُعالَج
  defaultMeta: systemContext,
  transports: [
    consoleTransport,
    appFileTransport,
    errorFileTransport,
  ],
  // لا تُوقِف العملية عند أخطاء السجلّ نفسه
  exitOnError: false,
  // معالج استثناءات غير مُمسَكة
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "90d",
      format: jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "90d",
      format: jsonFormat,
    }),
  ],
});

// تسجيل أحداث الدوران
appFileTransport.on("rotate", (oldFilename, newFilename) => {
  logger.info("Log file rotated", { oldFilename, newFilename });
});

// ─── واجهة TypeScript المكتوبة ────────────────────────────────────────────────

interface LogMeta {
  [key: string]: unknown;
}

interface TypedLogger {
  audit: (message: string, meta?: LogMeta) => void;
  error: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  http: (message: string, meta?: LogMeta) => void;
  debug: (message: string, meta?: LogMeta) => void;
}

const typedLogger: TypedLogger = {
  audit: (message, meta) => logger.log("audit", message, meta),
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  info: (message, meta) => logger.info(message, meta),
  http: (message, meta) => logger.http(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
};

export { typedLogger as logger };
export default typedLogger;