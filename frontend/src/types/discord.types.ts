// backend/types/discord.types.ts
import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";

// Discord Chat Type

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

// Discord MEDIA
// From real logs:
//  - attachments contain media
//  - embeds for links/GIFs

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

// Discord Message Type

export interface UnifiedDiscordMessage extends BaseUnifiedMessage {
  platform: "discord";

  /** Guild (server) where message originated */
  guildId: string;

  /** If this message comes from a thread */
  parentChatId?: string | null;

  /** Discord-specific message type */
  type: UnifiedDiscordMessageType;

  /** Original Discord sender ID */
  senderId: string;

  /** Attachments (images, videos, files) */
  media?: DiscordMedia[] | null;

  /** Embeds (links, GIF previews) */
  embeds?:
    | {
        url?: string | null;
        title?: string | null;
        description?: string | null;
        type?: "link" | "gif" | null;
      }[]
    | null;

  /** Optional thread-specific UI helpers */
  threadName?: string;
  parentType?: "thread";
}
