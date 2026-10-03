/* eslint-disable @typescript-eslint/no-unused-expressions */
import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { Server } from "socket.io";

import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma, checkDatabaseHealth } from "./lib/prisma";
import { socketAuthMiddleware } from "./middleware/auth";
import { handleConnectionLifecycle } from "./handlers/connection";
import { handleRoomEvents } from "./handlers/room";
import { handleMessageEvents } from "./handlers/message";
import { presenceStore } from "./state/presence";
import { rateLimiter } from "./state/rate-limiter";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";

// ─── Express application ──────────────────────────────────────────────────────

const app = express();

app.set("trust proxy", 1); // Trust X-Forwarded-For from reverse proxy (nginx/caddy)

app.use(
  cors({
    origin: env.NEXT_APP_URL,
    methods: ["GET", "HEAD"],
    credentials: true,
  })
);

app.use(express.json({ limit: "64kb" }));

// ── Request logging middleware ───────────────────────────────────────────────

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.path}`, {
    meta: { ip: req.ip, ua: req.headers["user-agent"] },
  });
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/health", async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  const presence = presenceStore.snapshot();

  const status = dbHealthy ? "ok" : "degraded";
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbHealthy ? "connected" : "disconnected",
    presence,
    version: process.env["npm_package_version"] ?? "unknown",
  });
});

// ── Metrics (Prometheus-compatible plaintext) ─────────────────────────────────

app.get("/metrics", (_req: Request, res: Response) => {
  const { onlineUsers, totalConnections } = presenceStore.snapshot();

  res.type("text/plain").send([
    `# HELP chat_online_users Number of distinct online users`,
    `# TYPE chat_online_users gauge`,
    `chat_online_users ${onlineUsers}`,
    ``,
    `# HELP chat_total_connections Total active socket connections`,
    `# TYPE chat_total_connections gauge`,
    `chat_total_connections ${totalConnections}`,
    ``,
    `# HELP process_uptime_seconds Server uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime().toFixed(2)}`,
  ].join("\n"));
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ─── HTTP server ──────────────────────────────────────────────────────────────

const httpServer = createServer(
  app as (req: IncomingMessage, res: ServerResponse) => void
);

// ─── Socket.io server ─────────────────────────────────────────────────────────

export const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: env.NEXT_APP_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },

  // Allow websocket upgrade with polling fallback for restrictive networks
  transports: ["websocket", "polling"],

  // Heartbeat configuration
  pingTimeout: 60_000,   // 60s before declaring a dead connection
  pingInterval: 25_000,  // probe every 25s

  // Prevent slow/malicious clients from stalling the upgrade
  upgradeTimeout: 30_000,

  // Reject oversized payloads (guards against DoS)
  maxHttpBufferSize: 1e6, // 1 MB

  // Automatic connection state recovery
  // Allows clients to resume room memberships after brief disconnections
  // (network flicker, sleep/wake) without re-joining manually
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60_000, // 2 minutes
    skipMiddlewares: false,              // still re-verify JWT on recovery
  },

    // Per-socket send queue size (prevents unbounded backpressure)
  perMessageDeflate: { threshold: 1024 },
});

// ─── Authentication middleware ────────────────────────────────────────────────
// Runs on every new connection (including recovery attempts).

io.use(socketAuthMiddleware);

// ─── Connection handler ───────────────────────────────────────────────────────

io.on("connection", (socket) => {
  // 1. Lifecycle: presence, broadcast online/offline, cleanup
  handleConnectionLifecycle(io, socket, presenceStore);
  // 2. Room management: join/leave/history/user-list
  handleRoomEvents(io, socket);
  // 3. Messaging: send, persist, broadcast, typing indicators
  handleMessageEvents(io, socket, presenceStore);
});

// ─── Adapter error handling ───────────────────────────────────────────────────
// Catch errors from the in-memory adapter (e.g., room broadcast failures).

io.engine.on("connection_error", (err) => {
  logger.error("Socket.io engine connection error", {
    meta: {
      code: err.code,
      message: err.message,
      context: err.context,
    },
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal} — starting graceful shutdown`, {
    meta: {
      onlineUsers: presenceStore.getOnlineUserCount(),
      totalConnections: presenceStore.getTotalConnections(),
    },
  });

  // 1. Stop accepting new connections
  httpServer.close();

  // 2. Broadcast shutdown notice to all connected clients
  io.emit("server_error", {
    code: "SERVER_ERROR",
    message: "Server is restarting. Please reconnect in a moment.",
  });

  // 3. Close all socket.io connections gracefully
  io.disconnectSockets(true);

  // 4. Allow in-flight operations to complete (5s grace period)
  await new Promise<void>((resolve) => setTimeout(resolve, 5_000));

  // 5. Destroy rate limiter
  rateLimiter.destroy();

  // 6. Disconnect Prisma
  try {
    await prisma.$disconnect();
    logger.info("Database connection closed");
  } catch (err) {
    logger.error("Error closing database connection", {
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  logger.info("Shutdown complete");
  process.exit(0);
}

// Force exit if graceful shutdown takes too long
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
  setTimeout(() => {
    logger.error("Forced exit: shutdown timed out after 30s");
    process.exit(1);
  }, 30_000).unref();
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
  setTimeout(() => {
    logger.error("Forced exit: shutdown timed out after 30s");
    process.exit(1);
  }, 30_000).unref();
});

// ─── Unhandled rejection / exception ─────────────────────────────────────────

process.on("uncaughtException", (err, origin) => {
  logger.error("Uncaught exception", {
    meta: {
      error: err.message,
      stack: err.stack,
      origin,
    },
  });
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled promise rejection", {
    meta: {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
    },
  });
  // Do NOT exit on unhandled rejections — log and continue
  // unless it's a critical resource (covered by uncaughtException)
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // Verify DB connection before accepting traffic
  const dbReady = await checkDatabaseHealth();
  if (!dbReady) {
    logger.error("Database is unreachable at startup — aborting");
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    logger.info("✅ EduSpark Chat Server started", {
      meta: {
        port: env.PORT,
        environment: env.NODE_ENV,
        allowedOrigin: env.NEXT_APP_URL,
        rateLimit: `${env.MAX_MESSAGES_PER_MINUTE} msg/min`,
        pid: process.pid,
        nodeVersion: process.version,
      },
    });
  });
}

void bootstrap();