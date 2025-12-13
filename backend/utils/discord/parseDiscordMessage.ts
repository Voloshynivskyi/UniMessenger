import {
  Message,
  Attachment,
  Embed,
  ThreadChannel,
  ChannelType,
} from "discord.js";

import type {
  UnifiedDiscordMessage,
  UnifiedDiscordMessageType,
  UnifiedMedia,
  UnifiedMediaKind,
} from "../../types/discord.types";

/* ============================================================
   MAIN PARSER
============================================================ */

export function parseDiscordMessage(input: {
  message: Message;
  accountId: string;
  guildId: string;
  channelId: string;
  botUserId?: string | null;
}): UnifiedDiscordMessage {
  const { message: msg, accountId, guildId, botUserId } = input;

  /* ---------- THREAD ---------- */
  const isThread =
    msg.channel.type === ChannelType.PublicThread ||
    msg.channel.type === ChannelType.PrivateThread ||
    msg.channel.type === ChannelType.AnnouncementThread;

  const thread = isThread ? (msg.channel as ThreadChannel) : null;

  const chatId = thread ? thread.id : msg.channelId;
  const parentChatId = thread?.parentId ?? null;

  /* ---------- MEDIA ---------- */
  const media: UnifiedMedia[] = [
    ...mapAttachments(msg.attachments.values()),
    ...mapEmbeds(msg.embeds),
  ];

  /* ---------- TYPE ---------- */
  const type: UnifiedDiscordMessageType = resolveType(media, msg.content ?? "");

  /* ---------- OUTGOING ---------- */
  const isOutgoing = !!botUserId && msg.author?.id === botUserId;

  return {
    platform: "discord",
    accountId,

    guildId,
    chatId,
    parentChatId,

    messageId: msg.id,
    date: msg.createdAt.toISOString(),
    status: isOutgoing ? "sent" : "delivered",

    isOutgoing,

    from: {
      id: msg.author.id,
      name: msg.author.username,
      username: msg.author.username,
      photoId: msg.author.avatar ?? null,
    },

    senderId: msg.author.id,

    type,
    text: msg.content ?? "",

    media: media.length ? media : null,

    ...(thread
      ? {
          threadName: thread.name,
          parentType: "thread" as const,
        }
      : {}),
  };
}

/* ============================================================
   HELPERS
============================================================ */

function resolveType(
  media: UnifiedMedia[],
  text: string
): UnifiedDiscordMessageType {
  if (media.length > 0) {
    return media[0]!.kind;
  }

  if (text.trim().length > 0) return "text";

  return "unknown";
}

/* ---------- ATTACHMENTS ---------- */

function mapAttachments(attachments: Iterable<Attachment>): UnifiedMedia[] {
  const out: UnifiedMedia[] = [];

  for (const a of attachments) {
    const kind = detectAttachmentKind(a);

    out.push({
      id: a.id,
      kind,
      url: a.url,
      fileName: a.name ?? null,
      mimeType: a.contentType ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      size: a.size ?? null,
    });
  }

  return out;
}

function detectAttachmentKind(a: Attachment): UnifiedMediaKind {
  const ct = a.contentType ?? "";

  if (ct.startsWith("image/")) return "photo";
  if (ct.startsWith("video/")) return "video";

  return "file";
}

/* ---------- EMBEDS ---------- */

function mapEmbeds(embeds: readonly Embed[]): UnifiedMedia[] {
  const out: UnifiedMedia[] = [];

  for (const e of embeds) {
    let url: string | null = null;
    let thumbnailUrl: string | null = null;

    if (typeof e.url === "string") {
      url = e.url;
    } else if (e.image && typeof e.image.url === "string") {
      url = e.image.url;
    }

    if (e.thumbnail && typeof e.thumbnail.url === "string") {
      thumbnailUrl = e.thumbnail.url;
    }

    if (!url) continue;

    const isGif = url.endsWith(".gif") || url.includes("gif");

    out.push({
      id: `embed:${url}`,
      kind: isGif ? "gif" : "link",
      url,
      thumbnailUrl,
    });
  }

  return out;
}
