// frontend/src/realtime/events.ts

import type {
  UnifiedTelegramMessage,
  UnifiedTelegramMessageType,
} from "../types/telegram.types";
export interface InterServerEvents {}

export interface BaseRealtimePayload {
  platform: "telegram" | "discord" | "slack";
  accountId: string;
  timestamp: string; // ISO8601
}

/* ========================================================================
   Telegram unified realtime payloads
   ======================================================================== */

// NEW MESSAGE
export interface TelegramNewMessagePayload extends BaseRealtimePayload {
  chatId: string;
  message: UnifiedTelegramMessage;
}

// EDITED MESSAGE
export interface TelegramMessageEditedPayload extends BaseRealtimePayload {
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

// TYPING
export interface TelegramTypingPayload extends BaseRealtimePayload {
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

// DELETED
export interface TelegramMessageDeletedPayload extends BaseRealtimePayload {
  chatId: string;
  messageIds: string[];
}

// READ UPDATED
export interface TelegramReadUpdatesPayload extends BaseRealtimePayload {
  chatId: string;
  lastReadMessageId: string;
  direction?: "inbox" | "outbox";
}

// ACCOUNT STATUS
export interface TelegramAccountStatusPayload extends BaseRealtimePayload {
  status: "online" | "offline" | "away" | "recently" | "hidden";
}

// VIEWS
export interface TelegramMessageViewPayload extends BaseRealtimePayload {
  chatId: string;
  messageId: string;
  views: number;
}

// PINNED
export interface TelegramPinnedMessagesPayload extends BaseRealtimePayload {
  chatId: string;
  messageIds: string[];
  pinned: boolean;
}

// ERROR
export interface TelegramErrorPayload extends BaseRealtimePayload {
  code: number;
  message: string;
  context?: string;
  severity?: "info" | "warning" | "critical";
}

// MESSAGE CONFIRMED (optimistic → real)
export interface TelegramMessageConfirmedPayload extends BaseRealtimePayload {
  chatId: string;
  tempId: string;
  realMessageId: string;
  date: string;
}

/* ========================================================================
   Server → Client events
   ======================================================================== */

export interface ServerToClientEvents {
  "realtime:connected": () => void;
  "system:pong": () => void;

  "telegram:new_message": (data: TelegramNewMessagePayload) => void;
  "telegram:typing": (data: TelegramTypingPayload) => void;
  "telegram:message_edited": (data: TelegramMessageEditedPayload) => void;
  "telegram:message_deleted": (data: TelegramMessageDeletedPayload) => void;
  "telegram:read_updates": (data: TelegramReadUpdatesPayload) => void;
  "telegram:account_status": (data: TelegramAccountStatusPayload) => void;
  "telegram:message_views": (data: TelegramMessageViewPayload) => void;
  "telegram:pinned_messages": (data: TelegramPinnedMessagesPayload) => void;
  "telegram:message_confirmed": (data: TelegramMessageConfirmedPayload) => void;

  "system:error": (data: TelegramErrorPayload) => void;
}

/* ========================================================================
   Client → Server events (unchanged)
   ======================================================================== */

export interface TelegramOutgoingMedia {
  fileId: string;
  type: UnifiedTelegramMessageType;
  mime: string;
  fileName?: string;
  size?: number;
  originalName: string;
}

export interface TelegramSendMessagePayload {
  accountId: string;
  chatId: string;
  tempId: string | number;
  text?: string;
  media?: TelegramOutgoingMedia;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
  replyToMessageId?: string;
}

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

export interface TelegramEditMessagePayload {
  accountId: string;
  chatId: string;
  messageId: string;
  newText: string;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
}

export interface TelegramDeleteMessagePayload {
  accountId: string;
  chatId: string;
  messageIds: string[];
  peerType?: "user" | "chat" | "channel";
  accessHash?: string;
}

export interface ClientToServerEvents {
  "system:ping": () => void;
  "telegram:send_message": (data: TelegramSendMessagePayload) => void;
  "telegram:typing_start": (data: TelegramTypingStartPayload) => void;
  "telegram:typing_stop": (data: TelegramTypingStopPayload) => void;
  "telegram:mark_as_read": (data: TelegramMarkAsReadPayload) => void;
  "telegram:edit_message": (data: TelegramEditMessagePayload) => void;
  "telegram:delete_message": (data: TelegramDeleteMessagePayload) => void;
}
