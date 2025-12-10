// frontend/src/types/unifiedMessage.types.ts
import type { UnifiedTelegramMessage } from "./telegram.types";
import type { UnifiedDiscordMessage } from "./discord.types";

export type UnifiedMessage = UnifiedTelegramMessage | UnifiedDiscordMessage;

/**
 * Base structure for any unified message across all platforms.
 * Every specific provider (Telegram, Discord, Slack) must extend this type.
 */

export type MessageStatus = "pending" | "sent" | "delivered" | "failed";
export type UnifiedMessagePlatform = "telegram" | "discord" | "slack";

export interface BaseUnifiedMessage {
  platform: UnifiedMessagePlatform;

  messageId: string | number;
  accountId: string;
  chatId: string;

  /** TEMP ID for messages created locally before backend assigns real messageId */
  tempId?: string | number | null;

  /** Delivery state */
  status: MessageStatus;

  text?: string;
  date: string;
  isOutgoing: boolean;

  from: {
    id: string;
    name: string;
    username?: string | null;
    photoId?: string | null;
  };
}
