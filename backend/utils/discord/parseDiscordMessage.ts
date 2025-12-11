// backend/utils/discord/parseDiscordMessage.ts

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
  DiscordMedia,
} from "../../types/discord.types";

// NEW SIGNATURE: receives ONE object argument
export function parseDiscordMessage(input: {
  message: Message;
  accountId: string; // тут це botId
  guildId: string;
  channelId: string;
  botUserId?: string | null;
}): UnifiedDiscordMessage {
  const { message: msg, accountId, botUserId } = input;

  const attachments = Array.from(msg.attachments.values());
  const embeds = Array.from(msg.embeds.values());

  const type = detectDiscordMessageType(attachments, embeds, msg.content ?? "");

  // THREAD CHECK
  const chType = msg.channel.type;
  const isThread =
    chType === ChannelType.PublicThread ||
    chType === ChannelType.PrivateThread ||
    chType === ChannelType.AnnouncementThread;

  const thread = isThread ? (msg.channel as ThreadChannel) : null;

  const chatId = thread ? thread.id : msg.channelId;
  const parentChatId = thread?.parentId ?? null;

  const isOutgoing = !!botUserId && msg.author?.id === botUserId ? true : false;

  return {
    platform: "discord",
    accountId, // == botId

    guildId: input.guildId,
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

    media: mapAttachments(attachments),
    embeds: mapEmbeds(embeds),

    ...(thread
      ? {
          threadName: thread.name,
          parentType: "thread" as const,
        }
      : {}),
  };
}

function detectDiscordMessageType(
  attachments: Attachment[],
  embeds: Embed[],
  content: string
): UnifiedDiscordMessageType {
  if (attachments.length > 0) {
    const a = attachments[0]!;
    const ct = a.contentType ?? "";

    if (ct.startsWith("image/")) return "photo";
    if (ct.startsWith("video/")) return "video";
    return "file";
  }

  if (embeds.length > 0) {
    const e = embeds[0]!;
    const url = e.url ?? "";

    if (url.includes(".gif") || url.includes("gif")) {
      return "gif";
    }

    return "link";
  }

  if (content.trim().length > 0) return "text";

  return "unknown";
}

function mapAttachments(atts: Attachment[]): DiscordMedia[] | null {
  if (atts.length === 0) return null;

  return atts.map((a) => ({
    id: a.id,
    url: a.url,
    fileName: a.name ?? null,
    mimeType: a.contentType ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
  }));
}

function mapEmbeds(embeds: Embed[]): any[] | null {
  if (embeds.length === 0) return null;

  return embeds.map((e) => {
    const url = e.url ?? null;
    const isGif =
      (url?.endsWith(".gif") ?? false) || (url?.includes("gif") ?? false);

    return {
      url,
      title: e.title ?? null,
      description: e.description ?? null,
      type: isGif ? "gif" : "link",
    };
  });
}
