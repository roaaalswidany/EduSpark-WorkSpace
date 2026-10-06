// ============================================================================
// EduSpark Chat Microservice — Main Server Entry Point
//
// التسلسل الكامل للتهيئة:
// 1. التحقّق من متغيّرات البيئة
// 2. إنشاء Express + HTTP Server
// 3. الاتصال بـ Redis وإعداد الـ Adapter
// 4. إعداد Socket.io مع CORS وجميع الـ middleware
// 5. تسجيل كل معالجات الأحداث
// 6. الاستماع على المنفذ المُحدَّد
// ============================================================================

import "dotenv/config";
import { createInternalRouter } from "./routes/internal";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./config/env";
import { initRedisClients, closeRedisClients } from "./config/redis";
import { prisma, checkDatabaseConnection } from "./lib/prisma";
import { logger } from "./lib/logger";
import { socketAuthMiddleware } from "./middleware/socket-auth";
import { registerConnectionHandlers, getConnectedUsersCount, getTotalConnectionsCount } from "./handlers/connection";
import { registerRoomHandlers } from "./handlers/room";
import { registerMessageHandlers } from "./handlers/message";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TypedServer,
} from "./types/socket.types";

// ─── Express Application ──────────────────────────────────────────────────────

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));

// CORS للطلبات HTTP العادية (health check, إلخ)
app.use(
  cors({
    origin: env.NEXTJS_APP_URL,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// ─── Health Check Endpoints ───────────────────────────────────────────────────

app.get("/health", async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseConnection();

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "1.0.0",
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    services: {
      database: dbHealthy ? "connected" : "disconnected",
      socket: "running",
    },
    connections: {
      uniqueUsers: getConnectedUsersCount(),
      totalSockets: getTotalConnectionsCount(),
    },
  });
});

app.get("/metrics", (_req: Request, res: Response) => {
  res.json({
    timestamp: new Date().toISOString(),
    connections: {
      uniqueUsers: getConnectedUsersCount(),
      totalSockets: getTotalConnectionsCount(),
    },
    process: {
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
    },
  });
});

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const httpServer = createServer(app);

// ─── Socket.io Server ────────────────────────────────────────────────────────

const io: TypedServer = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  // CORS لاتصالات WebSocket
  cors: {
    origin: env.NEXTJS_APP_URL,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Authorization"],
  },

  // السماح بالـ polling كاحتياط للشبكات التي تحجب WebSocket
  transports: ["websocket", "polling"],

  // إعدادات الاتصال
  pingTimeout: 60_000,       // 60 ثانية قبل اعتبار الاتصال ميتاً
  pingInterval: 25_000,      // نبضة كل 25 ثانية
  upgradeTimeout: 10_000,    // 10 ثوانٍ للترقية من polling إلى WebSocket
  maxHttpBufferSize: 1e6,    // 1 MB حجم أقصى للرسالة الواحدة

  // استعادة حالة الاتصال بعد انقطاع مؤقت
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60_000, // دقيقتان
    skipMiddlewares: false,               // إعادة تشغيل الـ middleware حتى بعد الاسترداد
  },
});

// ─── Bootstrap Function ───────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info("🚀 Starting EduSpark Chat Server...");

  // ── الخطوة 1: التحقّق من قاعدة البيانات ──────────────────────────────────
  logger.info("Checking database connection...");
  const dbHealthy = await checkDatabaseConnection();
  if (!dbHealthy) {
    logger.error("Cannot connect to database. Exiting.");
    process.exit(1);
  }
  logger.info("✅ Database connection established");

  // ── الخطوة 2: إعداد Redis Adapter ────────────────────────────────────────
  logger.info("Initializing Redis clients...");
  const { pubClient, subClient } = await initRedisClients();

  io.adapter(createAdapter(pubClient, subClient));
  logger.info("✅ Redis adapter configured for horizontal scaling");

  // ── الخطوة 3: تسجيل Middleware المصادقة ──────────────────────────────────
  // هذا يُنفَّذ قبل كل اتصال — الحارس الأمني الأوّل
  io.use((socket, next) => {
    socketAuthMiddleware(
      socket as Parameters<typeof socketAuthMiddleware>[0],
      next
    );
  });

  // ── الخطوة 4: معالج الاتصالات الجديدة ────────────────────────────────────
  io.on("connection", (socket) => {
    // تسجيل كل معالجات الأحداث للـ socket الجديد
    registerConnectionHandlers(socket, io);
    registerRoomHandlers(socket, io);
    registerMessageHandlers(socket, io);
  });

  // ── الخطوة 5: الاستماع على المنفذ ────────────────────────────────────────
  httpServer.listen(env.PORT, () => {
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(`🟢 EduSpark Chat Server is running`);
    logger.info(`   Port     : ${env.PORT}`);
    logger.info(`   Env      : ${env.NODE_ENV}`);
    logger.info(`   Origin   : ${env.NEXTJS_APP_URL}`);
    logger.info(`   Health   : http://localhost:${env.PORT}/health`);
    logger.info(`   Metrics  : http://localhost:${env.PORT}/metrics`);
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // إشعار المتصلين بالإغلاق الوشيك
  io.emit("server_error", {
    code: "SERVER_SHUTTING_DOWN",
    message: "Server is restarting. You will be reconnected automatically.",
    timestamp: new Date().toISOString(),
  });

  // إغلاق قبول الاتصالات الجديدة
  httpServer.close(async () => {
    logger.info("HTTP server closed");

    // قطع اتصالات Socket.io بشكل نظيف
    await io.close();
    logger.info("Socket.io server closed");

    // إغلاق اتصالات Redis
    await closeRedisClients();

    // إغلاق اتصال قاعدة البيانات
    await prisma.$disconnect();
    logger.info("Database disconnected");

    logger.info("✅ Graceful shutdown complete");
    process.exit(0);
  });

  // Force exit بعد 30 ثانية إن لم ينتهِ الـ graceful shutdown
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  void gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Don't crash on unhandled rejections — log and continue
});


// Mount internal HTTP routes (used by Next.js to push notifications)
app.use("/internal", createInternalRouter(io));

// ─── Start ────────────────────────────────────────────────────────────────────
bootstrap().catch((error) => {
  logger.error("Fatal bootstrap error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});