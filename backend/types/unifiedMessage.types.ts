// backend/types/unifiedMessage.types.ts
import type { UnifiedTelegramMessage } from "./telegram.types";
/**
 * Base structure for any unified message across all platforms.
 * Every specific provider (Telegram, Discord, Slack) must extend this type.
 */
export interface BaseUnifiedMessage {
  /** Identifier of the platform (Telegram, Discord, Slack) */
  platform: "telegram" | "discord" | "slack";

  /** Unique message ID from the provider */
  messageId: string | number;

  /** Unified chat key (accountId:peerType:peerId) */
  chatKey: string;

  /** Sender ID (varies by provider) */
  senderId: string | number | null;

  /** Message text (empty string if media-only) */
  text: string;

  /** Unix timestamp (ms) when the message was created */
  timestamp: number;

  /** Whether the message was sent by the authenticated user */
  isOutgoing: boolean;

  /** If edited, store the new timestamp here */
  editedTimestamp?: number | null;

  /** General reactions list (platform-specific) */
  reactions?: any[];

  /** Attachments or media metadata */
  attachments?: any[];
}

/**
 * Union type for all unified message types.
 * Frontend components should rely on this type.
 */
export type UnifiedMessage = UnifiedTelegramMessage;
//  | UnifiedDiscordMessage
//  | UnifiedSlackMessage;
