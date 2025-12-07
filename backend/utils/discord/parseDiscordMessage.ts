import { Message, Attachment, Embed } from "discord.js";
import type {
  UnifiedDiscordMessage,
  UnifiedDiscordMessageType,
  DiscordMedia,
} from "../../types/discord.types";

/* ============================================================
 * MAIN PARSER
 * ============================================================ */
export function parseDiscordMessage(
  msg: Message,
  accountId: string
): UnifiedDiscordMessage {
  const attachments = Array.from(msg.attachments.values());
  const embeds = Array.from(msg.embeds.values());

  const type = detectDiscordMessageType(attachments, embeds, msg.content ?? "");

  return {
    platform: "discord",
    accountId,

    chatId: msg.channelId,
    messageId: msg.id,
    date: msg.createdAt.toISOString(),

    status: "delivered",
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
  };
}

/* ============================================================
 * TYPE DETECTOR — 100% safe
 * ============================================================ */
function detectDiscordMessageType(
  attachments: Attachment[],
  embeds: Embed[],
  content: string
): UnifiedDiscordMessageType {
  if (attachments.length > 0) {
    const a = attachments[0]!; // NON-NULL ASSERTION (safe)

    const ct = a.contentType ?? "";
    if (ct.startsWith("image/")) return "photo";
    if (ct.startsWith("video/")) return "video";
    return "file";
  }

  if (embeds.length > 0) {
    const e = embeds[0]!; // NON-NULL ASSERTION

    const url = e.url ?? "";

    // GIF
    if (url.includes(".gif") || url.includes("gif")) {
      return "gif"; // not "animation"
    }

    return "link";
  }

  if (content.trim().length > 0) return "text";

  return "unknown";
}

/* ============================================================
 * ATTACHMENT MAPPER — safe
 * ============================================================ */
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

/* ============================================================
 * EMBED MAPPER — safe
 * ============================================================ */
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
