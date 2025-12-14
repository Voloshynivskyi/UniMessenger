// backend/realtime/events.ts

import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type { UnifiedDiscordMessage } from "../types/discord.types";

// Base / common
export interface InterServerEvents {}

export interface BaseRealtimePayload {
  platform: "telegram" | "discord" | "slack";
  accountId: string;
  timestamp: string; // ISO8601
}

// TELEGRAM realtime payloads
export interface TelegramNewMessagePayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  message: UnifiedTelegramMessage;
}

export interface TelegramMessageEditedPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  messageId: string;
  newText: string;

  from: {
    id: string;
    name: string;
    username?: string | null;
  };

  updated?: UnifiedTelegramMessage;
}

export interface TelegramTypingPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface TelegramMessageDeletedPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  messageIds: string[];
}

export interface TelegramReadUpdatesPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  lastReadMessageId: string;
  direction?: "inbox" | "outbox";
}

export interface TelegramAccountStatusPayload extends BaseRealtimePayload {
  platform: "telegram";
  status: "online" | "offline" | "away" | "recently" | "hidden";
}

export interface TelegramMessageViewPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  messageId: string;
  views: number;
}

export interface TelegramPinnedMessagesPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  messageIds: string[];
  pinned: boolean;
}

export interface TelegramErrorPayload extends BaseRealtimePayload {
  platform: "telegram";
  code: number;
  message: string;
  context?: string;
  severity?: "info" | "warning" | "critical";
}

export interface TelegramMessageConfirmedPayload extends BaseRealtimePayload {
  platform: "telegram";
  chatId: string;
  tempId: string;
  message: UnifiedTelegramMessage;
}

// DISCORD realtime payloads
export interface DiscordNewMessagePayload extends BaseRealtimePayload {
  platform: "discord";
  chatId: string;
  message: UnifiedDiscordMessage;
}

export interface DiscordMessageEditedPayload extends BaseRealtimePayload {
  platform: "discord";
  chatId: string;
  messageId: string;
  newText?: string | null;
  updated?: UnifiedDiscordMessage;
}

export interface DiscordTypingPayload extends BaseRealtimePayload {
  platform: "discord";
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface DiscordMessageDeletedPayload extends BaseRealtimePayload {
  platform: "discord";
  chatId: string;
  messageIds: string[];
}

export interface DiscordMessageConfirmedPayload extends BaseRealtimePayload {
  platform: "discord";
  chatId: string;
  tempId: string;
  message: UnifiedDiscordMessage;
}

export interface DiscordErrorPayload extends BaseRealtimePayload {
  platform: "discord";
  code: number;
  message: string;
  context?: string;
  severity?: "info" | "warning" | "critical";
}

// ✅ SCHEDULER realtime payloads
export interface SchedulerPostUpdatedPayload {
  postId: string;
  timestamp: string;
}

// Server → Client events
export interface ServerToClientEvents {
  "realtime:connected": () => void;
  "system:pong": () => void;

  // Telegram
  "telegram:new_message": (data: TelegramNewMessagePayload) => void;
  "telegram:typing": (data: TelegramTypingPayload) => void;
  "telegram:message_edited": (data: TelegramMessageEditedPayload) => void;
  "telegram:message_deleted": (data: TelegramMessageDeletedPayload) => void;
  "telegram:read_updates": (data: TelegramReadUpdatesPayload) => void;
  "telegram:account_status": (data: TelegramAccountStatusPayload) => void;
  "telegram:message_views": (data: TelegramMessageViewPayload) => void;
  "telegram:pinned_messages": (data: TelegramPinnedMessagesPayload) => void;
  "telegram:message_confirmed": (data: TelegramMessageConfirmedPayload) => void;

  // Discord
  "discord:new_message": (data: DiscordNewMessagePayload) => void;
  "discord:typing": (data: DiscordTypingPayload) => void;
  "discord:message_edited": (data: DiscordMessageEditedPayload) => void;
  "discord:message_deleted": (data: DiscordMessageDeletedPayload) => void;
  "discord:message_confirmed": (data: DiscordMessageConfirmedPayload) => void;

  // ✅ Scheduler
  "scheduler:post_updated": (data: SchedulerPostUpdatedPayload) => void;

  // System
  "system:error": (data: TelegramErrorPayload | DiscordErrorPayload) => void;
}

// Client → Server events
export interface TelegramTypingStartPayload {
  accountId: string;
  chatId: string;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
}

export interface TelegramTypingStopPayload {
  accountId: string;
  chatId: string;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
}

export interface TelegramMarkAsReadPayload {
  accountId: string;
  chatId: string;
  lastReadMessageId: string;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
}

export interface DiscordTypingStartPayload {
  accountId: string;
  chatId: string;
}

export interface DiscordTypingStopPayload {
  accountId: string;
  chatId: string;
}

export interface DiscordMarkAsReadPayload {
  accountId: string;
  chatId: string;
  lastReadMessageId: string;
}

export interface ClientToServerEvents {
  "system:ping": () => void;

  // Telegram
  "telegram:typing_start": (data: TelegramTypingStartPayload) => void;
  "telegram:typing_stop": (data: TelegramTypingStopPayload) => void;
  "telegram:mark_as_read": (data: TelegramMarkAsReadPayload) => void;

  // Discord
  "discord:typing_start": (data: DiscordTypingStartPayload) => void;
  "discord:typing_stop": (data: DiscordTypingStopPayload) => void;
  "discord:mark_as_read": (data: DiscordMarkAsReadPayload) => void;
}
