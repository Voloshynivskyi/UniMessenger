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
import { TelegramMessageIndexService } from "../services/telegram/telegramMessageIndexService";
import { TelegramUserResolverService } from "../services/telegram/telegramUserResolverService";
import bigInt from "big-integer";
import { outgoingTempStore } from "../realtime/outgoingTempStore";
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
  | "UpdateChannelTooLong"
  | "UpdateShortSentMessage";

interface HandlerContext {
  update: any;
  accountId: string; // TelegramAccount.id
  userId: string; // UniMessenger userId
}

type TelegramUpdateHandler = (ctx: HandlerContext) => Promise<void> | void;
// -----------------------------------------------------------------------------
// Helper: reconstruct peer from index record
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Helper: resolve chatId using update.peer OR index lookup if peer is missing
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Helper: resolve sender name via DB cache + Telegram RPC (through UserResolver)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// MAIN UPDATE HANDLERS
// -----------------------------------------------------------------------------
export const telegramUpdateHandlers: Record<
  TelegramUpdateType,
  TelegramUpdateHandler
> = {
  /* ------------------------------------------------------------
     NEW PRIVATE MESSAGE
  ------------------------------------------------------------ */
  UpdateShortMessage: async ({ update, accountId, userId }) => {
    const msg = update;
    const fromUserId = msg.userId?.toString() ?? "";

    const senderName = await resolveSenderName(accountId, fromUserId);

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      // In private messages, chatId is the same as fromUserId
      chatId: fromUserId,
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: fromUserId, name: senderName },
        isOutgoing: msg.out ?? false,
      },
    };

    // Save to message index
    await TelegramMessageIndexService.addIndex(
      accountId,
      payload.message.id,
      payload.chatId,
      new Date(msg.date * 1000),
      {
        rawPeerType: "user",
        rawPeerId: fromUserId,
        rawAccessHash: null,
      }
    );

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  /* ------------------------------------------------------------
     NEW GROUP MESSAGE
  ------------------------------------------------------------ */
  UpdateShortChatMessage: async ({ update, accountId, userId }) => {
    const msg = update;
    const fromUserId = extractUserId(msg.fromId) ?? "";

    const senderName = await resolveSenderName(accountId, fromUserId);

    const chatId = msg.chatId?.toString() ?? "unknown";

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      message: {
        id: msg.id.toString(),
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: { id: fromUserId, name: senderName },
        isOutgoing: msg.out ?? false,
      },
    };

    await TelegramMessageIndexService.addIndex(
      accountId,
      payload.message.id,
      payload.chatId,
      new Date(msg.date * 1000),
      {
        rawPeerType: "user",
        rawPeerId: fromUserId,
        rawAccessHash: null,
      }
    );

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

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
     EDIT MESSAGE (PRIVATE / GROUP)
  ------------------------------------------------------------ */
  UpdateEditMessage: async ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const messageId = String(msg.id);

    // Resolve chatId from peer or index
    const chatId = await resolveChatId(msg.peerId, accountId, messageId);

    const fromUserId =
      msg.fromId instanceof Api.PeerUser ? String(msg.fromId.userId) : "";

    const senderName = await resolveSenderName(accountId, fromUserId);

    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      messageId,
      newText: msg.message ?? "",
      from: { id: fromUserId, name: senderName },
    };

    // Do not create index for edits
    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
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
     NEW CHANNEL MESSAGE
  ------------------------------------------------------------ */
  UpdateNewChannelMessage: async ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const messageId = msg.id.toString();

    const fromUserId = extractUserId(msg.fromId);

    const senderName = await resolveSenderName(accountId, fromUserId ?? "");

    const chatId =
      (msg.peerId && telegramPeerToChatId(msg.peerId)) ||
      update.channelId?.toString() ||
      "unknown";

    const payload: TelegramNewMessagePayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      message: {
        id: messageId,
        text: msg.message ?? "",
        date: new Date(msg.date * 1000).toISOString(),
        from: fromUserId
          ? { id: fromUserId, name: senderName }
          : { id: "", name: "" },
        isOutgoing: !!msg.out,
      },
    };

    await TelegramMessageIndexService.addIndex(
      accountId,
      payload.message.id,
      payload.chatId,
      new Date(msg.date * 1000),
      {
        rawPeerType: "user",
        rawPeerId: fromUserId!,
        rawAccessHash: null,
      }
    );

    getSocketGateway().emitToUser(userId, "telegram:new_message", payload);
  },

  /* ------------------------------------------------------------
     EDIT CHANNEL MESSAGE
  ------------------------------------------------------------ */
  UpdateEditChannelMessage: async ({ update, accountId, userId }) => {
    const msg = update.message as Api.Message;

    const messageId = msg.id.toString();

    const chatId = await resolveChatId(msg.peerId, accountId, messageId);

    const fromUserId = msg.fromId ? msg.fromId.toString() : "";

    const senderName = await resolveSenderName(accountId, fromUserId);

    const payload: TelegramMessageEditedPayload = {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      messageId,
      newText: msg.message ?? "",
      from: { id: fromUserId, name: senderName },
    };

    // Do not create index for edits
    getSocketGateway().emitToUser(userId, "telegram:message_edited", payload);
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
  UpdateConnectionState: ({ update, accountId, userId }) => {
    const state = update.state === 1 ? "Connected" : "Disconnected";
  },
  // ------------------------------------------------------------
  // SENT MESSAGE CONFIRMATION
  // ------------------------------------------------------------
  UpdateShortSentMessage: async ({ update, accountId, userId }) => {
    const realMessageId = update.id.toString();
    const pts = update.pts;
    const date = update.date;

    // In GramJS UpdateShortSentMessage doesn't contain tempId
    // but the order corresponds to FIFO → take the FIRST pending outgoing
    const pending = outgoingTempStore.peek(accountId);
    if (!pending) return;

    const { tempId, chatId, text } = pending;

    // Confirm
    outgoingTempStore.remove(accountId, tempId);
    console.log("[UPDATE] ShortSentMessage received");
    console.log(update);

    getSocketGateway().emitToUser(userId, "telegram:message_confirmed", {
      platform: "telegram",
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      tempId,
      realMessageId,
      date: new Date(date * 1000).toISOString(),
    });

    // add to message index
    await TelegramMessageIndexService.addIndex(
      accountId,
      realMessageId,
      chatId,
      new Date(date * 1000),
      { rawPeerType: "user", rawPeerId: chatId, rawAccessHash: null }
    );
  },
};

// Validate that all handlers exist (for main types)
(function validateHandlers() {
  const defined = Object.keys(telegramUpdateHandlers);
  const expected: TelegramUpdateType[] = [
    "UpdateShortMessage",
    "UpdateShortChatMessage",
    "UpdateUserTyping",
    "UpdateChatUserTyping",
    "UpdateUserStatus",
    "UpdateDeleteMessages",
    "UpdateEditMessage",
    "UpdateReadHistoryInbox",
    "UpdateReadHistoryOutbox",
    "UpdateConnectionState",
    "UpdateShortSentMessage",
  ];

  const missing = expected.filter((e) => !defined.includes(e));
  if (missing.length > 0) {
    logger.warn("Missing Telegram update handlers:", {
      missing: missing.join(", "),
    });
  }
})();
