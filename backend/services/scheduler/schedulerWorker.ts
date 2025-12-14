// backend/services/scheduler/schedulerWorker.ts

import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { executeScheduledPost } from "./schedulerExecutor";
import { getSocketGateway } from "../../realtime/socketGateway";

const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 3000);
const BATCH = Number(process.env.SCHEDULER_BATCH || 10);
const STUCK_SENDING_MS = Number(
  process.env.SCHEDULER_STUCK_MS || 5 * 60 * 1000
);

let timer: NodeJS.Timeout | null = null;

async function reclaimStuckSending() {
  const threshold = new Date(Date.now() - STUCK_SENDING_MS);

  const res = await prisma.scheduledPost.updateMany({
    where: {
      status: "sending",
      updatedAt: { lt: threshold },
    },
    data: {
      status: "scheduled",
      lastError: null,
    },
  });

  if (res.count > 0) {
    logger.warn(
      `[SchedulerWorker] Reclaimed stuck sending posts: ${res.count}`
    );
  }
}

async function claimDuePosts(now: Date) {
  const due = await prisma.scheduledPost.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH,
    select: { id: true, userId: true },
  });

  const claimed: { id: string; userId: string }[] = [];

  for (const p of due) {
    const updated = await prisma.scheduledPost.updateMany({
      where: { id: p.id, status: "scheduled" },
      data: { status: "sending", lastError: null },
    });

    if (updated.count === 1) {
      claimed.push({ id: p.id, userId: p.userId });
    }
  }

  return claimed;
}

async function tick() {
  const now = new Date();

  try {
    await reclaimStuckSending();

    const claimed = await claimDuePosts(now);
    if (claimed.length === 0) return;

    logger.info(`[SchedulerWorker] Claimed ${claimed.length} posts`);

    for (const c of claimed) {
      try {
        await executeScheduledPost(c.id);

        getSocketGateway().emitToUser(c.userId, "scheduler:post_updated", {
          postId: c.id,
          timestamp: new Date().toISOString(),
        });
      } catch (e: any) {
        logger.error("[SchedulerWorker] executeScheduledPost failed", {
          postId: c.id,
          error: e?.message ?? e,
        });
      }
    }
  } catch (e: any) {
    logger.error("[SchedulerWorker] tick failed", {
      error: e?.message ?? e,
    });
  }
}

export function startSchedulerWorker() {
  if (timer) return;

  logger.info(
    `[SchedulerWorker] Starting (poll=${POLL_MS}ms stuck=${STUCK_SENDING_MS}ms)`
  );

  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopSchedulerWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info("[SchedulerWorker] Stopped");
}
