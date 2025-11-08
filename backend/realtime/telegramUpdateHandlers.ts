import type {
  TelegramNewMessagePayload,
  TelegramTypingPayload,
  TelegramAccountStatusPayload,
  TelegramMessageDeletedPayload,
  TelegramMessageEditedPayload,
  TelegramReadUpdatesPayload,
} from "./events";
import { getSocketGateway } from "./socketGateway";
import { Api } from "telegram";

export function isTelegramUpdateType(key: string): key is TelegramUpdateType {
  return key in telegramUpdateHandlers;
}

// ------------------------------------------------------------------
// Types of Telegram updates we handle
// ------------------------------------------------------------------
export type TelegramUpdateType =
  | "UpdateShortMessage"
  | "UpdateShortChatMessage"
  | "UpdateUserTyping"
  | "UpdateUserStatus"
  | "UpdateDeleteMessages"
  | "UpdateEditMessage"
  | "UpdateReadHistoryInbox"
  | "UpdateReadHistoryOutbox"
  | "UpdateConnectionState";

// ------------------------------------------------------------------
// Context for Telegram update handlers
// ------------------------------------------------------------------
interface HandlerContext {
  update: any;
  accountId: string;
  userId: string;
}

// ------------------------------------------------------------------
// Type of Telegram update handler function
// ------------------------------------------------------------------
type TelegramUpdateHandler = (ctx: HandlerContext) => Promise<void> | void;

// ------------------------------------------------------------------
// Realization of Telegram update handlers
// ------------------------------------------------------------------
export const telegramUpdateHandlers: Record<
  TelegramUpdateType,
  TelegramUpdateHandler
> = {
  // New message (private chat)
  UpdateShortMessage: ({ update, accountId, userId }) => {
    const msg = update;
    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: msg.userId?.toString() ?? "unknown",
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: msg.userId?.toString() ?? "", name: "" },
        isOutgoing: msg.out ?? false,
      },
    };
    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  // New message (group)
  UpdateShortChatMessage: ({ update, accountId, userId }) => {
    const msg = update;
    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: msg.chatId?.toString() ?? "unknown",
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: msg.fromId?.toString() ?? "", name: "" },
        isOutgoing: msg.out ?? false,
      },
    };
    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  // User typing update
  UpdateUserTyping: ({ update, accountId, userId }) => {
    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.peer?.toString() ?? "unknown",
      userId: update.userId?.toString() ?? "",
      isTyping: true,
    };
    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  // User status update
  UpdateUserStatus: ({ update, accountId, userId }) => {
    const statusName =
      update.status?.className?.replace("UserStatus", "").toLowerCase() ??
      "offline";

    const payload: TelegramAccountStatusPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      status:
        (statusName as "online" | "offline" | "away" | "recently" | "hidden") ??
        "offline",
    };

    getSocketGateway().emitToUser(userId, "telegram:account_status", payload);
  },

  // Delete message
  UpdateDeleteMessages: ({ update, accountId, userId }) => {
    const payload: TelegramMessageDeletedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: "unknown",
      messageIds: (update.messages ?? []).map((id: number) => id.toString()),
    };
    getSocketGateway().emitToUser(userId, "telegram:message_deleted", payload);
  },

  // Edit message
  UpdateEditMessage: ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;
    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: msg.peerId?.toString() ?? "unknown",
      messageId: msg.id.toString(),
      newText: msg.message ?? "",
    };
    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
  },

  // Read updates (inbox)
  UpdateReadHistoryInbox: ({ update, accountId, userId }) => {
    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.peer?.toString() ?? "unknown",
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "inbox",
    };
    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },

  // Read updates (outbox)
  UpdateReadHistoryOutbox: ({ update, accountId, userId }) => {
    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.peer?.toString() ?? "unknown",
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "outbox",
    };
    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },
  UpdateConnectionState: ({ update, accountId, userId }) => {
    const state = update.state == 1 ? "Connected" : "Disconnected";
    console.debug(
      `[ConnectionState] Account ${accountId} from user ${userId}: ${state}`
    );
  },
};

// ------------------------------------------------------------------
// Check that all handlers are implemented
// ------------------------------------------------------------------
(function validateHandlers() {
  const defined = Object.keys(telegramUpdateHandlers);
  const expected: TelegramUpdateType[] = [
    "UpdateShortMessage",
    "UpdateShortChatMessage",
    "UpdateUserTyping",
    "UpdateUserStatus",
    "UpdateDeleteMessages",
    "UpdateEditMessage",
    "UpdateReadHistoryInbox",
    "UpdateReadHistoryOutbox",
    "UpdateConnectionState",
  ];

  const missing = expected.filter((e) => !defined.includes(e));
  if (missing.length > 0) {
    console.warn("⚠️ Missing Telegram update handlers:", missing.join(", "));
  }
})();
