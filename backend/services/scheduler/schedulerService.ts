import { prisma } from "../../lib/prisma";
import { ScheduledPlatform, ScheduledPostStatus } from "@prisma/client";
import telegramClientManager from "../telegram/telegramClientManager";
import { discordClientManager } from "../discord/discordClientManager";
import { Api } from "telegram";
import bigInt from "big-integer";

/* ============================================================
   TYPES
============================================================ */

type CreateTargetDTO = {
  platform: "telegram" | "discord";

  telegramAccountId?: string | null;
  peerType?: "user" | "chat" | "channel" | null;
  peerId?: string | null;
  accessHash?: string | null;

  discordBotId?: string | null;
  channelId?: string | null;
  threadId?: string | null;
};

/* ============================================================
   HELPERS
============================================================ */

function toCompactPost(p: {
  id: string;
  text: string;
  scheduledAt: Date;
  status: any;
  targets: any[];
}) {
  return {
    id: p.id,
    text: p.text,
    scheduledAt: p.scheduledAt.toISOString(),
    status: p.status,
    targetsCount: p.targets.length,
  };
}

/* ============================================================
   TARGET RESOLVERS (UI-READY)
============================================================ */

async function resolveTelegramTarget(t: any) {
  let title = "Telegram";
  let subtitle = "Telegram chat";

  if (!t.telegramAccountId || !t.peerType || !t.peerId) {
    return { title, subtitle };
  }

  const peer =
    t.peerType === "user"
      ? new Api.PeerUser({ userId: bigInt(t.peerId) })
      : t.peerType === "chat"
      ? new Api.PeerChat({ chatId: bigInt(t.peerId) })
      : new Api.PeerChannel({ channelId: bigInt(t.peerId) });

  const entity = telegramClientManager.resolveSenderEntity(
    t.telegramAccountId,
    peer
  );

  if (entity instanceof Api.User) {
    const name =
      `${entity.firstName ?? ""} ${entity.lastName ?? ""}`.trim() ||
      "Saved Messages";

    title = name;
    subtitle = entity.username ? `@${entity.username}` : "Telegram user";
  }

  if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
    title = entity.title ?? "Telegram chat";
    subtitle = "Telegram chat";
  }

  return { title, subtitle };
}

function resolveDiscordTarget(t: any) {
  let title = "Discord";
  let subtitle = "Discord channel";

  if (!t.discordBotId) return { title, subtitle };

  const client = discordClientManager.getClient(t.discordBotId);
  if (!client) return { title, subtitle };

  if (t.threadId) {
    const thread = client.channels.cache.get(t.threadId) as any;
    const parent = thread?.parent;
    const guild = thread?.guild;

    if (thread) {
      title = thread.name;
      subtitle =
        parent && guild ? `#${parent.name} · ${guild.name}` : "Discord thread";
    }
  } else if (t.channelId) {
    const channel = client.channels.cache.get(t.channelId) as any;
    const guild = channel?.guild;

    if (channel) {
      title = `#${channel.name}`;
      subtitle = guild?.name ?? "Discord server";
    }
  }

  return { title, subtitle };
}

/* ============================================================
   SERVICE
============================================================ */

export class SchedulerService {
  /* ---------- LIST ---------- */
  async listPosts(args: { userId: string; from?: Date; to?: Date }) {
    const where: any = { userId: args.userId };

    if (args.from || args.to) {
      where.scheduledAt = {};
      if (args.from) where.scheduledAt.gte = args.from;
      if (args.to) where.scheduledAt.lte = args.to;
    }

    const posts = await prisma.scheduledPost.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      include: { targets: true },
    });

    return posts.map(toCompactPost);
  }

  /* ---------- CREATE ---------- */
  async createPost(args: {
    userId: string;
    text: string;
    scheduledAt: Date;
    targets: CreateTargetDTO[];
  }) {
    const text = String(args.text).trim();
    if (!text) throw new Error("text is required");

    const created = await prisma.scheduledPost.create({
      data: {
        userId: args.userId,
        text,
        scheduledAt: args.scheduledAt,
        status: ScheduledPostStatus.scheduled,
        targets: {
          create: args.targets.map((t) =>
            t.platform === "telegram"
              ? {
                  platform: ScheduledPlatform.telegram,
                  telegramAccountId: t.telegramAccountId ?? null,
                  peerType: t.peerType ?? null,
                  peerId: t.peerId ?? null,
                  accessHash: t.accessHash ?? null,
                }
              : {
                  platform: ScheduledPlatform.discord,
                  discordBotId: t.discordBotId ?? null,
                  channelId: t.channelId ?? null,
                  threadId: t.threadId ?? null,
                }
          ),
        },
      },
      include: { targets: true },
    });

    return toCompactPost(created);
  }

  /* ---------- DELETE ---------- */
  async deletePost(userId: string, id: string) {
    const post = await prisma.scheduledPost.findFirst({
      where: { id, userId },
    });
    if (!post) throw new Error("Post not found");

    await prisma.scheduledPost.delete({ where: { id } });
    return { ok: true };
  }

  /* ---------- CANCEL ---------- */
  async cancelPost(userId: string, id: string) {
    const post = await prisma.scheduledPost.findFirst({
      where: { id, userId },
    });
    if (!post) throw new Error("Post not found");

    if (post.status !== ScheduledPostStatus.scheduled) {
      throw new Error("Only scheduled posts can be canceled");
    }

    const updated = await prisma.scheduledPost.update({
      where: { id },
      data: { status: ScheduledPostStatus.canceled, lastError: null },
      include: { targets: true },
    });

    return toCompactPost(updated);
  }

  /* ---------- RETRY ---------- */
  async retryPost(userId: string, id: string) {
    const post = await prisma.scheduledPost.findFirst({
      where: { id, userId },
    });
    if (!post) throw new Error("Post not found");

    if (post.status !== ScheduledPostStatus.failed) {
      throw new Error("Only failed posts can be retried");
    }

    await prisma.scheduledPostTarget.updateMany({
      where: { postId: id },
      data: { status: "pending", lastError: null },
    });

    const updated = await prisma.scheduledPost.update({
      where: { id },
      data: { status: ScheduledPostStatus.scheduled, lastError: null },
      include: { targets: true },
    });

    return toCompactPost(updated);
  }

  /* ---------- DETAILS ---------- */
  async getPostById(userId: string, id: string) {
    const post = await prisma.scheduledPost.findFirst({
      where: { id, userId },
      include: { targets: { orderBy: { id: "asc" } } },
    });

    if (!post) throw new Error("Post not found");

    const targets = await Promise.all(
      post.targets.map(async (t) => {
        const ui =
          t.platform === ScheduledPlatform.telegram
            ? await resolveTelegramTarget(t)
            : resolveDiscordTarget(t);

        return {
          id: t.id,
          platform: t.platform,
          status: t.status,
          lastError: t.lastError,
          title: ui.title,
          subtitle: ui.subtitle,
        };
      })
    );

    return {
      id: post.id,
      text: post.text,
      scheduledAt: post.scheduledAt.toISOString(),
      status: post.status,
      lastError: post.lastError,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      targets,
    };
  }
}

export const schedulerService = new SchedulerService();
