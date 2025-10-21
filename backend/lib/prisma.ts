/**
 * backend/lib/prisma.ts
 * Centralized Prisma client instance to avoid multiple DB connections
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "info", "warn", "error"], // optional: logs for debugging
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
