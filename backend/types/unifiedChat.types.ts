// backend/types/unifiedChat.types.ts
import type { UnifiedTelegramChat } from "./telegram.types";
//import { UnifiedSlackChat } from "./slackChat.types";

import type { UnifiedDiscordChat } from "./discord.types";

export type UnifiedChat = UnifiedTelegramChat | UnifiedDiscordChat;

export type UnifiedChatPlatform = "telegram" | "discord" | "slack";

export interface BaseUnifiedChat {
  /** platform identifier */
  platform: UnifiedChatPlatform;

  /** account which owns the chat */
  accountId: string;

  /** chat unique ID inside the platform */
  chatId: string;

  /** generic peer type */
  peerType?: "user" | "chat" | "channel" | null;

  /** generic display title */
  title?: string;

  /** name shown to user in UI */
  displayName?: string;

  /** unread messages count */
  unreadCount?: number;

  /** pinned in list */
  pinned?: boolean;

  /** last message summary */
  lastMessage?: {
    id: string;
    text?: string;
    type:
      | "text"
      | "photo"
      | "video"
      | "voice"
      | "sticker"
      | "file"
      | "link"
      | "service"
      | "unknown";
    date: string;
    from: {
      id: string;
      name: string;
      username?: string | null;
    };
    isOutgoing?: boolean;
    views?: number;
    isPinned?: boolean;
  };
}
