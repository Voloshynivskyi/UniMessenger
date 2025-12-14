/**
 * backend/server.ts
 * Initializes the Express server with global middleware, routes, and unified error handling.
 */
import healthRoutes from "./routes/health";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import telegramRoutes from "./routes/telegram";
import discordRoutes from "./routes/discord";
import schedulerRoutes from "./routes/scheduler";
import { createSocketServer } from "./realtime/socketServer";
import { clearLog } from "./utils/debugLogger";
import {
  startSchedulerWorker,
  stopSchedulerWorker,
} from "./services/scheduler/schedulerWorker";
import telegramClientManager from "./services/telegram/telegramClientManager";
import { logger } from "./utils/logger";

clearLog();
dotenv.config();

export const app = express();

/** Global middleware */
app.use(cors());
app.use(express.json());

/**
 * @route GET /
 * @desc Root endpoint confirming API is running
 * @access Public
 */
app.get("/", (_: Request, res: Response) => {
  res.json({ status: "ok", message: "UniMessenger API running" });
});

/**
 * @route GET /api/health
 * @desc Health check endpoint for monitoring systems (K8s, load balancers)
 * @access Public
 */
app.use("/api/health", healthRoutes);

/** API Routes */
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/discord", discordRoutes);
app.use("/api/scheduler", schedulerRoutes);

/**
 * Unified fallback route
 */
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

/**
 * Global error handler
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[GlobalErrorHandler]:", err);
  res.status(err.status || 500).json({
    status: "error",
    code: err.code || "UNEXPECTED",
    message: err.message || "Internal server error",
  });
});

/** Start server and Socket.IO */
const { server } = createSocketServer(app);
const PORT = process.env.PORT || 7007;

(async () => {
  // 1) Restore Telegram clients
  try {
    logger.info("Restoring active Telegram clients...");
    await telegramClientManager.restoreActiveClients();
    logger.info("Telegram clients restored successfully.");
  } catch (err) {
    logger.error("Failed to restore Telegram clients:", { err });
  }

  // 2) Restore Discord clients — TODO (поки заглушка)
  try {
    logger.info("Discord clients restored successfully.");
  } catch (err) {
    logger.error("Failed to restore Discord clients:", { err });
  }

  // 3) Start scheduler worker
  startSchedulerWorker();

  // 4) Start Express + Socket.IO
  server.listen(PORT, () => {
    logger.info(`Express + Socket.IO running on http://localhost:${PORT}`);
  });
})();

/** Graceful shutdown */
async function shutdown(signal: string) {
  try {
    logger.info(`${signal} received. Shutting down...`);
    stopSchedulerWorker();
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  } catch (e) {
    logger.error("Shutdown failed", { e });
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
