// backend/types/unifiedChat.types.ts
import type { UnifiedTelegramChat } from "./telegram.types";
//import { UnifiedDiscordChat } from "./discordChat.types";
//import { UnifiedSlackChat } from "./slackChat.types";

export type UnifiedChat = UnifiedTelegramChat;
//  | UnifiedDiscordChat
//  | UnifiedSlackChat;

export interface BaseUnifiedChat {
  platform: "telegram" | "discord" | "slack";
  accountId: string;
  chatId: string;

  title?: string;
  displayName?: string;
  unreadCount?: number;
  pinned?: boolean;

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
