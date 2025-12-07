// backend/types/discord.types.ts
import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";

/* ============================================================
 * Discord Chat Type
 * ============================================================ */

export interface UnifiedDiscordChat extends BaseUnifiedChat {
  platform: "discord";

  /** Original Discord guild ID (server) */
  guildId: string;

  /** Channel or thread name */
  name: string;

  /** Channel or thread type */
  discordType: "text" | "thread" | "forum" | "unknown";

  /** True if this chat is a thread inside a parent channel */
  isThread?: boolean;

  /** Parent channel for thread */
  parentId?: string | null;

  /** Channel topic (if exists) */
  topic?: string | null;

  /** Discord-specific flags */
  nsfw?: boolean;
  archived?: boolean;
}

/* ============================================================
 * Discord MEDIA
 * From real logs:
 *  - attachments contain media
 *  - embeds for links/GIFs
 * ============================================================ */

export type UnifiedDiscordMessageType =
  | "text"
  | "photo"
  | "video"
  | "file"
  | "gif"
  | "link"
  | "service"
  | "unknown";

export interface DiscordMedia {
  /** Attachment ID from Discord */
  id: string;

  /** Downloadable URL */
  url: string;

  /** Original file name */
  fileName?: string | null;

  /** MIME type (image/jpeg, video/mp4, application/pdf…) */
  mimeType?: string | null;

  /** Image / video resolution */
  width?: number | null;
  height?: number | null;

  /** For video */
  duration?: number | null;

  /** For GIF embeds */
  isAnimated?: boolean;
}

/* ============================================================
 * Discord Message Type
 * ============================================================ */

export interface UnifiedDiscordMessage extends BaseUnifiedMessage {
  platform: "discord";

  /** Discord channel or thread ID */
  chatId: string;

  /** Discord message ID */
  messageId: string;

  /** Sender */
  senderId: string | null;

  /** Message type */
  type: UnifiedDiscordMessageType;

  /** Text content */
  text?: string;

  /** Media (photo, video, file) — always extracted from attachments[] */
  media?: DiscordMedia[] | null;

  /** For embeds (links, GIF previews) */
  embeds?:
    | {
        url?: string | null;
        title?: string | null;
        description?: string | null;
        type?: "link" | "gif" | null;
      }[]
    | null;
}
