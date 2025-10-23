// backend/controllers/healthController.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * Basic readiness check (used by load balancers, K8s).
 * Checks if database is connected.
 */
export async function getHealth(req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: "DB_UNAVAILABLE",
      message: "Database connection failed",
    });
  }
}
