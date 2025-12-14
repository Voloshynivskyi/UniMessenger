// backend/services/scheduler/schedulerExecutor.ts

import { prisma } from "../../lib/prisma";
import telegramClientManager from "../telegram/telegramClientManager";
import { discordService } from "../discord/discordService";
import { logger } from "../../utils/logger";

function toBigInt(value: string | number | bigint): bigint {
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new Error(`Invalid peerId: ${value}`);
  }
}

export async function executeScheduledPost(postId: string) {
  const post = await prisma.scheduledPost.findUnique({
    where: { id: postId },
    include: { targets: true },
  });

  if (!post) return;

  let hasFailure = false;
  let lastError: string | null = null;

  for (const target of post.targets) {
    try {
      if (target.platform === "telegram") {
        if (!target.telegramAccountId || !target.peerType || !target.peerId) {
          throw new Error("Invalid telegram target payload");
        }

        // 🔒 strict peerType normalization
        const peerType =
          target.peerType === "user" ||
          target.peerType === "chat" ||
          target.peerType === "channel"
            ? target.peerType
            : (() => {
                throw new Error(`Invalid peerType: ${target.peerType}`);
              })();

        const peerId = toBigInt(target.peerId);

        if (peerType !== "chat" && !target.accessHash) {
          throw new Error(`accessHash is required for peerType=${peerType}`);
        }

        await telegramClientManager.sendText(
          target.telegramAccountId,
          peerType,
          peerId,
          target.accessHash ?? null,
          post.text
        );
      }

      if (target.platform === "discord") {
        if (!target.discordBotId || !target.channelId) {
          throw new Error("Invalid discord target payload");
        }

        await discordService.sendMessage(
          target.discordBotId,
          target.channelId,
          post.text,
          post.userId
        );
      }

      await prisma.scheduledPostTarget.update({
        where: { id: target.id },
        data: { status: "sent", lastError: null },
      });
    } catch (e: any) {
      hasFailure = true;
      lastError = String(e?.message ?? e);

      await prisma.scheduledPostTarget.update({
        where: { id: target.id },
        data: { status: "failed", lastError },
      });

      logger.error("[SchedulerExecutor] Target failed", {
        postId,
        targetId: target.id,
        lastError,
      });
    }
  }

  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: hasFailure ? "failed" : "sent",
      lastError: hasFailure ? lastError : null,
    },
  });
}
