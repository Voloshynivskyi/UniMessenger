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
import telegramClientManager from "../services/telegram/telegramClientManager";
import { extractUserId } from "../utils/extractUserId";
export function isTelegramUpdateType(key: string): key is TelegramUpdateType {
  return key in telegramUpdateHandlers;
}

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

interface HandlerContext {
  update: any;
  accountId: string;
  userId: string;
}

type TelegramUpdateHandler = (ctx: HandlerContext) => Promise<void> | void;

export const telegramUpdateHandlers: Record<
  TelegramUpdateType,
  TelegramUpdateHandler
> = {
  /* ============================================================
     PRIVATE MESSAGE
  ============================================================ */
  UpdateShortMessage: async ({ update, accountId, userId }) => {
    const msg = update;
    const fromUserId = msg.userId?.toString() ?? "";
    logger.info(
      `[Telegram] New private message from ${fromUserId} to account ${accountId}`
    );
    const senderName =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: fromUserId,
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: fromUserId, name: senderName },
        isOutgoing: msg.out ?? false,
      },
    };

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  /* ============================================================
     GROUP MESSAGE
  ============================================================ */
  UpdateShortChatMessage: async ({ update, accountId, userId }) => {
    const msg = update;
    const fromUserId = extractUserId(msg.fromId) ?? "";

    logger.info(
      `[Telegram] New group message from ${fromUserId} to account ${accountId}`
    );
    const senderName =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: msg.chatId?.toString() ?? "unknown",
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: fromUserId, name: senderName },
        isOutgoing: msg.out ?? false,
      },
    };

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  /* ============================================================
     PRIVATE TYPING
  ============================================================ */
  UpdateUserTyping: async ({ update, accountId, userId }) => {
    const fromUserId = update.userId?.toString() ?? "";
    logger.info(
      `[Telegram] New private typing from ${fromUserId} to account ${accountId}`
    );
    const username =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: fromUserId,
      userId: fromUserId,
      username,
      isTyping: true,
    };

    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  /* ============================================================
     USER STATUS
  ============================================================ */
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

  /* ============================================================
     DELETE MESSAGE
  ============================================================ */
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

  /* ============================================================
     EDIT MESSAGE (PRIVATE / GROUP)
  ============================================================ */
  UpdateEditMessage: async ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const fromUserId = msg.fromId?.toString() ?? "";
    logger.info(
      `[Telegram] New edit message from ${fromUserId} to account ${accountId}`
    );
    const senderName =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId: msg.peerId?.toString() ?? "unknown",
      messageId: msg.id.toString(),
      newText: msg.message ?? "",
      from: { id: fromUserId, name: senderName },
    };

    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
  },

  /* ============================================================
     GROUP TYPING
  ============================================================ */
  UpdateChatUserTyping: async ({ update, accountId, userId }) => {
    const chatId = update.chatId?.toString() ?? "unknown";
    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";
    logger.info(
      `[Telegram] New group typing from ${fromUserId} to account ${accountId}`
    );
    const username =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      userId: fromUserId,
      username,
      isTyping: true,
    };

    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  /* ============================================================
     NEW CHANNEL MESSAGE
  ============================================================ */
  UpdateNewChannelMessage: async ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const fromUserId = extractUserId(msg.fromId);
    const senderName =
      (await telegramClientManager.getUserName(accountId, fromUserId ?? "")) ||
      fromUserId ||
      "";

    logger.info(
      `[Telegram] New channel message from ${fromUserId} to account ${accountId}`
    );
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
        from: fromUserId
          ? { id: fromUserId, name: senderName }
          : { id: "", name: "" },
        isOutgoing: !!msg.out,
      },
    };

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  /* ============================================================
     CHANNEL TYPING
  ============================================================ */
  UpdateChannelUserTyping: async ({ update, accountId, userId }) => {
    const chatId = update.channelId?.toString() ?? "unknown";

    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";
    logger.info(
      `[Telegram] New channel typing from ${fromUserId} to account ${accountId}`
    );
    const username =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramTypingPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      userId: fromUserId,
      username,
      isTyping: true,
    };

    getSocketGateway().emitToUser(userId, "telegram:typing", payload);
  },

  /* ============================================================
     EDIT CHANNEL MESSAGE
  ============================================================ */
  UpdateEditChannelMessage: async ({ update, accountId, userId }) => {
    const msg = update.message;

    const fromUserId = msg.fromId?.toString() ?? "";
    logger.info(
      `[Telegram] New edit channel message from ${fromUserId} to account ${accountId}`
    );
    const senderName =
      (await telegramClientManager.getUserName(accountId, fromUserId)) ||
      fromUserId;

    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId:
        msg.peerId?.toString() ?? update.channelId?.toString() ?? "unknown",
      messageId: msg.id.toString(),
      newText: msg.message ?? "",
      from: { id: fromUserId, name: senderName },
    };

    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
  },

  /* ============================================================
     DELETE CHANNEL MSG
  ============================================================ */
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

  /* ============================================================
     READ UPDATES
  ============================================================ */
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

  /* ============================================================
     MESSAGE VIEWS
  ============================================================ */
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

  /* ============================================================
     PIN
  ============================================================ */
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

  UpdateChannelTooLong: ({ update }) => {
    logger.warn(
      `[Telegram] Channel ${update.channelId} too long (pts=${update.pts}) — should refresh`
    );
  },
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

  UpdateConnectionState: ({ update, accountId, userId }) => {
    const state = update.state === 1 ? "Connected" : "Disconnected";
    logger.info(
      `[ConnectionState] Account ${accountId} from user ${userId}: ${state}`
    );
  },
};

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
    logger.warn("⚠️ Missing Telegram update handlers:", {
      missing: missing.join(", "),
    });
  }
})();
