// backend/realtime/events.ts
export interface InterServerEvents {}

export interface BaseRealtimePayload {
  platform: "telegram";
  accountId: string; // TELEGRAM_ACCOUNT_ID
  /** ISO8601 timestamp of the event */
  timestamp: string; // ISO-String
}

// Server-To-Client Events

export interface TelegramNewMessagePayload extends BaseRealtimePayload {
  chatId: string;
  message: {
    id: string;
    text: string;
    date: string;
    from: {
      id: string;
      name: string;
    };
    isOutgoing: boolean;
  };
}

export interface TelegramTypingPayload extends BaseRealtimePayload {
  chatId: string;
  userId: string;
  isTyping: boolean;
}

export interface TelegramMessageEditedPayload extends BaseRealtimePayload {
  chatId: string;
  messageId: string;
  newText: string;
}

export interface TelegramMessageDeletedPayload extends BaseRealtimePayload {
  chatId: string;
  messageId: string[] | string;
}

export interface TelegramReadUpdatesPayload extends BaseRealtimePayload {
  chatId: string;
  lastReadMessageId: string;
}

export interface TelegramAccountStatusPayload extends BaseRealtimePayload {
  status: "online" | "offline" | "away";
}

export interface TelegramErrorPayload extends BaseRealtimePayload {
  code: number;
  message: string;
  context?: string; // Additional context about where the error occurred
}

export interface ServerToClientEvents {
  "realtime:connected": () => void;
  "telegram:new_message": (data: TelegramNewMessagePayload) => void;
  "telegram:typing": (data: TelegramTypingPayload) => void;
  "telegram:message_edited": (data: TelegramMessageEditedPayload) => void;
  "telegram:message_deleted": (data: TelegramMessageDeletedPayload) => void;
  "telegram:read_updates": (data: TelegramReadUpdatesPayload) => void;
  "telegram:account_status": (data: TelegramAccountStatusPayload) => void;
  "system:error": (data: TelegramErrorPayload) => void;
}

// Client-To-Server Events

export interface TelegramSendMessagePayload {
  accountId: string;
  chatId: string;
  text: string;
}

export interface TelegramTypingStartPayload {
  accountId: string;
  chatId: string;
}

export interface TelegramTypingStopPayload {
  accountId: string;
  chatId: string;
}

export interface TelegramMarkAsReadPayload {
  accountId: string;
  chatId: string;
  lastReadMessageId: string;
}

export interface ClientToServerEvents {
  "telegram:send_message": (data: TelegramSendMessagePayload) => void;
  "telegram:typing_start": (data: TelegramTypingStartPayload) => void;
  "telegram:typing_stop": (data: TelegramTypingStopPayload) => void;
  "telegram:mark_as_read": (data: TelegramMarkAsReadPayload) => void;
}
