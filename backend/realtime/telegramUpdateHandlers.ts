// backend/realtime/telegramUpdateHandlers.ts

import type {
  TelegramTypingPayload,
  TelegramAccountStatusPayload,
  TelegramMessageDeletedPayload,
  TelegramReadUpdatesPayload,
  TelegramMessageViewPayload,
  TelegramPinnedMessagesPayload,
} from "./events";

import { getSocketGateway } from "./socketGateway";
import { Api } from "telegram";
import { telegramPeerToChatId } from "../utils/telegram/telegramPeerToChatId";
import { logger } from "../utils/logger";
import telegramClientManager from "../services/telegram/telegramClientManager";
import { TelegramMessageIndexService } from "../services/telegram/telegramMessageIndexService";
import { TelegramUserResolverService } from "../services/telegram/telegramUserResolverService";
import bigInt from "big-integer";

export type TelegramUpdateType =
  | "UpdateUserTyping"
  | "UpdateChatUserTyping"
  | "UpdateUserStatus"
  | "UpdateDeleteMessages"
  | "UpdateReadHistoryInbox"
  | "UpdateReadHistoryOutbox"
  | "UpdateConnectionState"
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
  accountId: string; // TelegramAccount.id
  userId: string; // UniMessenger userId
}

type TelegramUpdateHandler = (ctx: HandlerContext) => Promise<void> | void;

export function isTelegramUpdateType(key: string): key is TelegramUpdateType {
  return key in telegramUpdateHandlers;
}

// Helper: reconstruct peer from index record
function buildPeerFromRecord(record: any) {
  const { rawPeerType, rawPeerId } = record;

  if (!rawPeerType || !rawPeerId) return null;

  if (rawPeerType === "user") {
    return new Api.PeerUser({
      userId: bigInt(rawPeerId),
    });
  }

  if (rawPeerType === "chat") {
    return new Api.PeerChat({
      chatId: bigInt(rawPeerId),
    });
  }

  if (rawPeerType === "channel") {
    return new Api.PeerChannel({
      channelId: bigInt(rawPeerId),
    });
  }

  return null;
}

/**
 * Resolves the chat ID from various sources with fallback mechanisms
 *
 * This function attempts to determine the chat ID using multiple strategies:
 * 1. Direct extraction from the update's peer object
 * 2. Database lookup using message ID (with read-after-write protection)
 * 3. Peer reconstruction from cached database record
 *
 * The function implements retry logic to handle race conditions where messages
 * may not yet be indexed when the update arrives.
 *
 * @param rawPeer - The peer object from the Telegram update
 * @param accountId - The Telegram account ID
 * @param messageId - Optional message ID for database lookup
 * @returns Resolved chat ID or "unknown" if resolution fails
 */
async function resolveChatId(
  rawPeer: any,
  accountId: string,
  messageId?: string
): Promise<string> {
  console.log("---- resolveChatId ----");
  console.log("rawPeer:", rawPeer);
  console.log("accountId:", accountId);
  console.log("messageId:", messageId);

  // 1. Try to get directly from update.peer
  const direct = telegramPeerToChatId(rawPeer);
  console.log("direct chatId:", direct);
  if (direct) return direct;

  // 2. If no peer and no messageId → that's it, end
  if (!messageId) return "unknown";

  console.log("No direct peer. Using DB getRecord()…");

  // 3. Wait for record (read-after-write protection)
  let record = null;
  for (let i = 0; i < 5; i++) {
    record = await TelegramMessageIndexService.getRecord(accountId, messageId);
    console.log(`getRecord attempt ${i} →`, record);

    if (record) break;

    await new Promise((r) => setTimeout(r, 20));
  }

  if (!record) {
    console.log("getRecord returned NULL → unknown");
    return "unknown";
  }

  console.log("Record found:", record);

  // 4. If chatId exists — return it
  if (record.chatId) {
    console.log("Returning record.chatId:", record.chatId);
    return record.chatId;
  }

  // 5. Try to reconstruct peer
  const restoredPeer = buildPeerFromRecord(record);
  console.log("restoredPeer:", restoredPeer);

  if (!restoredPeer) return "unknown";

  const reconstructedChatId = telegramPeerToChatId(restoredPeer);
  console.log("reconstructedChatId:", reconstructedChatId);

  return reconstructedChatId || "unknown";
}

/**
 * Resolves the sender's display name from user ID
 *
 * This function retrieves the sender's name by:
 * 1. Checking the local database cache (TelegramUserCache)
 * 2. Fetching from Telegram API via UserResolverService if not cached
 * 3. Falling back to the user ID if resolution fails
 *
 * @param accountId - The Telegram account ID
 * @param fromUserId - The sender's Telegram user ID
 * @returns The sender's display name or user ID as fallback
 */
async function resolveSenderName(
  accountId: string,
  fromUserId: string | null | undefined
): Promise<string> {
  const fallback = fromUserId ?? "";

  if (!fromUserId) return fallback;

  const client = telegramClientManager.getClient(accountId);
  if (!client) {
    // no active client
    return fallback;
  }

  try {
    const user = await TelegramUserResolverService.getUser(
      accountId,
      client,
      fromUserId
    );
    return user?.name ?? fallback;
  } catch (err) {
    logger.warn("[TelegramUserResolver] Failed to resolve user name", {
      accountId,
      fromUserId,
      err,
    });
    return fallback;
  }
}

/**
 * Main Telegram update handlers registry
 *
 * This object maps each Telegram update type to its corresponding handler function.
 * These handlers process raw MTProto updates that don't represent full message events
 * (e.g., typing indicators, read receipts, deletions, status changes).
 *
 * Full message events (new/edited messages) are handled separately by dedicated handlers.
 */
export const telegramUpdateHandlers: Record<
  TelegramUpdateType,
  TelegramUpdateHandler
> = {
  /* ------------------------------------------------------------
     TYPING: PRIVATE
  ------------------------------------------------------------ */
  UpdateUserTyping: async ({ update, accountId, userId }) => {
    const fromUserId = update.userId?.toString() ?? "";

    const username = await resolveSenderName(accountId, fromUserId);

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

  /* ------------------------------------------------------------
     GROUP TYPING
  ------------------------------------------------------------ */
  UpdateChatUserTyping: async ({ update, accountId, userId }) => {
    const chatId = update.chatId?.toString() ?? "unknown";

    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";

    const username = await resolveSenderName(accountId, fromUserId);

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

  // ------------------------------------------------------------
  // CHANNEL TYPING
  // ------------------------------------------------------------
  UpdateChannelUserTyping: async ({ update, accountId, userId }) => {
    const chatId = update.channelId?.toString() ?? "unknown";

    const fromUserId =
      update.fromId?.className === "PeerUser"
        ? update.fromId.userId?.toString()
        : "";

    const username = await resolveSenderName(accountId, fromUserId);

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

  /* ------------------------------------------------------------
     USER STATUS
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     DELETE MESSAGE (PRIVATE / GROUP)
  ------------------------------------------------------------ */
  UpdateDeleteMessages: async ({ update, accountId, userId }) => {
    console.log("Handling UpdateDeleteMessages", { update, accountId, userId });
    const messageIds = update.messages.map((id: number) => id.toString());

    // Resolve chatId using peer OR index
    const chatId = await resolveChatId(update.peer, accountId, messageIds[0]);
    console.log("Resolved chatId for deleted messages:", chatId);

    const payload: TelegramMessageDeletedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      messageIds,
    };

    // Save deletion info into DB index
    await TelegramMessageIndexService.markDeleted(accountId, messageIds);

    getSocketGateway().emitToUser(userId, "telegram:message_deleted", payload);
  },

  /* ------------------------------------------------------------
     DELETE CHANNEL MESSAGES
  ------------------------------------------------------------ */
  UpdateDeleteChannelMessages: async ({ update, accountId, userId }) => {
    const messageIds = update.messages.map((id: number) => id.toString());

    const chatId = await resolveChatId(update.peer, accountId, messageIds[0]);

    const payload: TelegramMessageDeletedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      messageIds,
    };

    await TelegramMessageIndexService.markDeleted(accountId, messageIds);

    getSocketGateway().emitToUser(userId, "telegram:message_deleted", payload);
  },

  /* ------------------------------------------------------------
     READ UPDATES (CHANNEL INBOX)
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     CHANNEL MESSAGE VIEWS
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     PIN EVENTS
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     CHANNEL TOO LONG
  ------------------------------------------------------------ */
  UpdateChannelTooLong: ({ update }) => {
    logger.warn(
      `[Telegram] Channel ${update.channelId} too long (pts=${update.pts}) — should refresh`
    );
  },

  /* ------------------------------------------------------------
     READ UPDATES (PRIVATE)
  ------------------------------------------------------------ */
  UpdateReadHistoryInbox: ({ update, accountId, userId }) => {
    const chatId = telegramPeerToChatId(update.peer)!;

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
    const chatId = telegramPeerToChatId(update.peer)!;

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

  /* ------------------------------------------------------------
     CONNECTION STATE
  ------------------------------------------------------------ */
  UpdateConnectionState: ({ update, accountId }) => {
    const state = update.state === 1 ? "Connected" : "Disconnected";
    // logger.info(
    //   `[Telegram] Connection state for account ${accountId}: ${state}`
    // );
  },
};
/**
 * Validates that all expected handlers are defined
 *
 * This validation function checks at startup that all critical update types
 * have registered handlers, logging warnings for any missing implementations.
 */
(function validateHandlers() {
  const defined = Object.keys(telegramUpdateHandlers);
  const expected: TelegramUpdateType[] = [
    "UpdateUserTyping",
    "UpdateChatUserTyping",
    "UpdateChannelUserTyping",
    "UpdateUserStatus",
    "UpdateDeleteMessages",
    "UpdateDeleteChannelMessages",
    "UpdateReadHistoryInbox",
    "UpdateReadHistoryOutbox",
    "UpdateReadChannelInbox",
    "UpdateReadChannelOutbox",
    "UpdateChannelMessageViews",
    "UpdatePinnedMessages",
    "UpdatePinnedChannelMessages",
    "UpdateConnectionState",
    "UpdateChannelTooLong",
  ];

  const missing = expected.filter((e) => !defined.includes(e));
  if (missing.length > 0) {
    logger.warn("Missing Telegram update handlers:", {
      missing: missing.join(", "),
    });
  }
})();
