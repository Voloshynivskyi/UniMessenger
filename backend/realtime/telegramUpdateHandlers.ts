// backend/realtime/telegramUpdateHandlers.ts
import type {
  TelegramNewMessagePayload,
  TelegramTypingPayload,
  TelegramAccountStatusPayload,
  TelegramMessageDeletedPayload,
  TelegramMessageEditedPayload,
  TelegramReadUpdatesPayload,
  TelegramMessageViewPayload,
  TelegramPinnedMessagesPayload,
} from "./events";
import { getSocketGateway } from "./socketGateway";
import { Api } from "telegram";
import { telegramPeerToChatId } from "../utils/telegramPeerToChatId";
import { logger } from "../utils/logger";

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
  | "UpdateChatUserTyping"
  | "UpdateUserStatus"
  | "UpdateDeleteMessages"
  | "UpdateEditMessage"
  | "UpdateReadHistoryInbox"
  | "UpdateReadHistoryOutbox"
  | "UpdateConnectionState"
  | "UpdateNewChannelMessage"
  | "UpdateEditChannelMessage"
  | "UpdateDeleteChannelMessages"
  | "UpdateReadChannelInbox"
  | "UpdateReadChannelOutbox"
  | "UpdateChannelUserTyping"
  | "UpdateChannelMessageViews"
  | "UpdatePinnedMessages"
  | "UpdatePinnedChannelMessages"
  | "UpdateChannelTooLong";

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
    const chatId = update.userId?.toString() ?? "";
    const fromUserId = update.userId?.toString() ?? "";

    logger.info("[TYPING][PRIVATE] UpdateUserTyping", {
      raw: update,
      resolved: {
        chatId,
        fromUserId,
      },
      accountId,
      userId,
    });

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      userId: fromUserId,
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
    const chatId = telegramPeerToChatId(update.peer, "unknown");

    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "inbox",
    };

    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },
  // Read updates (outbox)
  UpdateReadHistoryOutbox: ({ update, accountId, userId }) => {
    const chatId = telegramPeerToChatId(update.peer, "unknown");

    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "outbox",
    };

    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },
  // Connection state update
  UpdateConnectionState: ({ update, accountId, userId }) => {
    const state = update.state == 1 ? "Connected" : "Disconnected";
    logger.debug(
      `[ConnectionState] Account ${accountId} from user ${userId}: ${state}`
    );
  },
  // New message in a channel / supergroup
  UpdateNewChannelMessage: ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const chatId =
      (msg.peerId && telegramPeerToChatId(msg.peerId as any, undefined)) ||
      update.channelId?.toString() ||
      "unknown";

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: msg.fromId?.toString() ?? "", name: "" },
        isOutgoing: !!msg.out,
      },
    };

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },
  UpdateChatUserTyping: ({ update, accountId, userId }) => {
    const chatId = update.chatId?.toString() ?? "unknown";
    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";

    logger.info("[TYPING][GROUP] UpdateChatUserTyping", {
      raw: update,
      resolved: {
        chatId,
        fromUserId,
      },
      accountId,
      userId,
    });

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      userId: fromUserId,
      isTyping: true,
    };

    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  // Edit message in a channel
  UpdateEditChannelMessage: ({ update, accountId, userId }) => {
    const msg = update.message;
    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId:
        msg.peerId?.toString() ?? update.channelId?.toString() ?? "unknown",
      messageId: msg.id.toString(),
      newText: msg.message ?? "",
    };
    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
  },

  // Delete messages in a channel
  UpdateDeleteChannelMessages: ({ update, accountId, userId }) => {
    const payload: TelegramMessageDeletedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.channelId?.toString() ?? "unknown",
      messageIds: (update.messages ?? []).map((id: number) => id.toString()),
    };
    getSocketGateway().emitToUser(userId, "telegram:message_deleted", payload);
  },
  // Read updates in a channel (inbox)
  UpdateReadChannelInbox: ({ update, accountId, userId }) => {
    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.channelId?.toString() ?? "unknown",
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "inbox",
    };
    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },
  // Read updates in a channel (outbox)
  UpdateReadChannelOutbox: ({ update, accountId, userId }) => {
    const payload: TelegramReadUpdatesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.channelId?.toString() ?? "unknown",
      lastReadMessageId: update.maxId?.toString() ?? "",
      direction: "outbox",
    };
    getSocketGateway().emitToUser(userId, "telegram:read_updates", payload);
  },
  // Someone is typing in a channel / supergroup
  UpdateChannelUserTyping: ({ update, accountId, userId }) => {
    const chatId = update.channelId?.toString() ?? "unknown";
    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";

    logger.info("[TYPING][CHANNEL] UpdateChannelUserTyping", {
      raw: update,
      resolved: {
        chatId,
        fromUserId,
      },
      accountId,
      userId,
    });

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      userId: fromUserId,
      isTyping: true,
    };

    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  // Update message views
  UpdateChannelMessageViews: ({ update, accountId, userId }) => {
    const payload: TelegramMessageViewPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.channelId?.toString() ?? "unknown",
      messageId: update.id?.toString() ?? "",
      views: update.views ?? 0,
    };
    getSocketGateway().emitToUser(userId, "telegram:message_views", payload);
  },

  // Pin/unpin messages in regular chats
  UpdatePinnedMessages: ({ update, accountId, userId }) => {
    const payload: TelegramPinnedMessagesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.peer?.toString() ?? "unknown",
      messageIds: (update.messages ?? []).map((id: number) => id.toString()),
      pinned: update.pinned ?? false,
    };
    getSocketGateway().emitToUser(userId, "telegram:pinned_messages", payload);
  },

  // Pin/unpin messages in a channel
  UpdatePinnedChannelMessages: ({ update, accountId, userId }) => {
    const payload: TelegramPinnedMessagesPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: update.channelId?.toString() ?? "unknown",
      messageIds: (update.messages ?? []).map((id: number) => id.toString()),
      pinned: update.pinned ?? false,
    };
    getSocketGateway().emitToUser(userId, "telegram:pinned_messages", payload);
  },

  // Channel too long update
  UpdateChannelTooLong: ({ update, accountId, userId }) => {
    logger.warn(
      `[Telegram] Channel ${update.channelId} too long (pts=${update.pts}) — should refresh`
    );
    // Currently no specific event is emitted for this update
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
    logger.warn("⚠️ Missing Telegram update handlers:", { missing: missing.join(", ") });
  }
})();
