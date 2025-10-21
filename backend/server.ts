/**
 * backend/server.ts
 * Main Express server setup with middleware, routes, and database connection
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import telegramRoutes from "./routes/telegram";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (_, res) => {
  res.send("🚀 UniMessenger API running");
});
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/telegram", telegramRoutes);
app.get("/api/test-db", async (_, res) => {
  const count = await prisma.user.count();
  res.json({ message: "Database connected", users: count });
});

const PORT = process.env.PORT || 7007;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
