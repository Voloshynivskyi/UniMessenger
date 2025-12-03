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
import { createSocketServer } from "./realtime/socketServer";
import { clearLog } from "./utils/debugLogger";
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
import telegramClientManager from "./services/telegram/telegramClientManager";
import { logger } from "./utils/logger";
const { server } = createSocketServer(app);

const PORT = process.env.PORT || 7007;
(async () => {
  try {
    logger.info("Restoring active Telegram clients...");
    await telegramClientManager.restoreActiveClients();
    logger.info("Telegram clients restored successfully.");
  } catch (err) {
    logger.error("Failed to restore Telegram clients:", { err });
  }

  // 🚀 Запускаємо сервер
  server.listen(PORT, () => {
    logger.info(`🚀 Express + Socket.IO running on http://localhost:${PORT}`);
  });
})();

/** Graceful shutdown */
process.on("SIGINT", async () => {
  logger.info("SIGINT received. Closing database connection.");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Closing database connection.");
  await prisma.$disconnect();
  process.exit(0);
});
