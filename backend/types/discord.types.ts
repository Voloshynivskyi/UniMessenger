import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";

/* ===================== CHAT ===================== */

export interface UnifiedDiscordChat extends BaseUnifiedChat {
  platform: "discord";

  guildId: string;
  name: string;

  discordType: "text" | "thread" | "forum" | "unknown";

  isThread?: boolean;
  parentId?: string | null;

  topic?: string | null;
  nsfw?: boolean;
  archived?: boolean;
}

/* ===================== MEDIA ===================== */

export type UnifiedMediaKind = "photo" | "video" | "file" | "gif" | "link";

export interface UnifiedMedia {
  id: string;
  kind: UnifiedMediaKind;

  url: string;

  fileName?: string | null;
  mimeType?: string | null;

  width?: number | null;
  height?: number | null;

  size?: number | null;
  duration?: number | null;

  thumbnailUrl?: string | null;
}

/* ===================== MESSAGE ===================== */

export type UnifiedDiscordMessageType =
  | "text"
  | UnifiedMediaKind
  | "service"
  | "unknown";

export interface UnifiedDiscordMessage extends BaseUnifiedMessage {
  platform: "discord";

  guildId: string;
  parentChatId?: string | null;

  type: UnifiedDiscordMessageType;
  senderId: string;

  media?: UnifiedMedia[] | null;

  threadName?: string;
  parentType?: "thread";
}
