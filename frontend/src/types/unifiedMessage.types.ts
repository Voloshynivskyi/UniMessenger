// frontend/src/types/unifiedMessage.types.ts
import type { UnifiedTelegramMessage } from "./telegram.types";

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
  };
}

/**
 * Union type for all unified message types.
 * Frontend components should rely on this type.
 */
export type UnifiedMessage = UnifiedTelegramMessage;
//  | UnifiedDiscordMessage
//  | UnifiedSlackMessage;
