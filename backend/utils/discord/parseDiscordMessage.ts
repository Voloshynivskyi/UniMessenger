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

// MAIN PARSER — FINAL, SAFE, THREAD-AWARE
export function parseDiscordMessage(
  msg: Message,
  accountId: string
): UnifiedDiscordMessage {
  const attachments = Array.from(msg.attachments.values());
  const embeds = Array.from(msg.embeds.values());

  const type = detectDiscordMessageType(attachments, embeds, msg.content ?? "");

  // ✅ THREAD DETECTION (ABSOLUTELY SAFE)
  const channelType = msg.channel.type;
  const isThread =
    channelType === ChannelType.PublicThread ||
    channelType === ChannelType.PrivateThread ||
    channelType === ChannelType.AnnouncementThread;

  const thread = isThread ? (msg.channel as ThreadChannel) : null;

  // CHAT ID POLICY (CRITICAL FOR UNIFIED INBOX)
  // chatId        → what you open as a chat
  // parentChatId  → hierarchy (for threads)

  const chatId = thread ? thread.id : msg.channelId;
  const parentChatId = thread?.parentId ?? null;

  return {
    platform: "discord",
    accountId,

    chatId,
    parentChatId, // Now always stable for threads

    messageId: msg.id,
    date: msg.createdAt.toISOString(),

    status: "delivered",

    // IMPORTANT: here accountId ≠ discordUserId
    // We keep this as is, because Unified was built this way
    isOutgoing: msg.author.id === accountId,

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

    // ✅ DEBUG / UI HELPERS (НЕ ЛАМАЮТЬ ТИПИ)
    ...(thread
      ? {
          threadName: thread.name,
          parentType: "thread",
        }
      : {}),
  };
}

// TYPE DETECTOR — SAFE & FINAL
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

// ATTACHMENT MAPPER — SAFE
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

// EMBED MAPPER — SAFE
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
