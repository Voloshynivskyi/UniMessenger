// backend/services/telegram/telegramClientManager.ts

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { prisma } from "../../lib/prisma";
import { decryptSession } from "../../utils/telegramSession";
import { logger } from "../../utils/logger";
import { Api } from "telegram";
import bigInt from "big-integer";
import { parseTelegramDialogs } from "../../utils/parseTelegramDialogs";
import { resolveTelegramPeer } from "../../utils/resolveTelegramPeer";
import type { TelegramGetDialogsResult } from "../../types/telegram.types";
import {
  isTelegramUpdateType,
  telegramUpdateHandlers,
} from "../../realtime/telegramUpdateHandlers";
import { TelegramMessageIndexService } from "./telegramMessageIndexService";
import { outgoingTempStore } from "../../realtime/outgoingTempStore";

const API_ID = process.env.TELEGRAM_API_ID
  ? Number(process.env.TELEGRAM_API_ID)
  : undefined;
const API_HASH = process.env.TELEGRAM_API_HASH;

if (!API_ID || !API_HASH) {
  logger.warn(
    "[TelegramClientManager] TELEGRAM_API_ID or TELEGRAM_API_HASH is not set. Telegram clients will not work correctly."
  );
}

export class TelegramClientManager {
  // Key: telegramAccountId
  private clients = new Map<string, TelegramClient>();

  // Key: telegramAccountId, Value: unimessengerUserId
  private accountToUser = new Map<string, string>();

  // For control of repeatable attachAllForUser
  private initializedForUser = new Set<string>();

  // For simple control of client restarts
  private reconnectAttempts = new Map<string, number>();

  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 5_000;

  // Get the Telegram client for a specific Telegram account
  public getClient(accountId: string): TelegramClient | undefined {
    return this.clients.get(accountId);
  }
  // Check if a Telegram client is active for a specific Telegram account
  public isClientActive(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  // Keep the Telegram client online by periodically sending updates
  public async keepOnline(client: TelegramClient) {
    try {
      // Set initial online status (only if connected)
      if (client.connected) {
        await client.invoke(new Api.account.UpdateStatus({ offline: false }));
        logger.info("[Telegram] Client is now ONLINE");
      }

      // Keep-alive loop
      setInterval(async () => {
        try {
          // Check connection status
          if (!client.connected) {
            logger.warn(
              "[Telegram] Client disconnected. Trying to reconnect..."
            );
            try {
              await client.connect();
              await client.getMe();
              try {
                await client.getDialogs({ limit: 200 });
                console.log("[Telegram] Dialogs preload done");
              } catch (e) {
                console.warn("[Telegram] Failed to preload dialogs", e);
              }
              logger.info("[Telegram] Reconnected successfully.");
            } catch (reconnectErr) {
              logger.error("[Telegram] Reconnect failed:", { reconnectErr });
              return;
            }
          }

          // Send a lightweight request to keep the session active
          await client.invoke(new Api.updates.GetState());
          await client.invoke(new Api.account.UpdateStatus({ offline: false }));
        } catch (err) {
          logger.warn("[Telegram] Keep-alive ping failed:", { err });
        }
      }, 60_000);
    } catch (err) {
      logger.error("[Telegram] Failed to go online:", { err });
    }
  }

  // Attach and initialize a Telegram client for a specific Telegram account
  public async attachAccount(
    accountId: string,
    userId?: string,
    encryptedSession?: string
  ): Promise<void> {
    if (!API_ID || !API_HASH) return;

    // If client already exists - do nothing
    if (this.clients.has(accountId)) {
      logger.warn(
        `[TelegramClientManager] Client already exists for account ${accountId}, skipping`
      );
      return;
    }

    let sessionString = encryptedSession;
    let resolvedUserId = userId;

    // If userId/session not provided - fetch from database
    if (!sessionString || !resolvedUserId) {
      const account = await prisma.telegramAccount.findUnique({
        where: { id: accountId },
        include: { session: true, user: true },
      });

      if (!account || !account.session || !account.session.sessionString) {
        logger.warn(
          `[TelegramClientManager] Cannot attach account ${accountId}: no session`
        );
        return;
      }

      sessionString = account.session.sessionString;
      resolvedUserId = account.userId;
    }

    if (!sessionString || !resolvedUserId) {
      logger.warn(
        `[TelegramClientManager] Missing userId/session for account ${accountId}`
      );
      return;
    }

    // 1. Decrypt MTProto session
    const decrypted = decryptSession(sessionString);
    const stringSession = new StringSession(decrypted);

    // 2. Create client
    const client = new TelegramClient(stringSession, API_ID!, API_HASH!, {
      connectionRetries: 5,
    });

    try {
      // 3. Connect to Telegram
      await client.connect();
      await client.getMe();
      try {
        await client.getDialogs({ limit: 200 });
        console.log("[Telegram] Dialogs preload done");
      } catch (e) {
        console.warn("[Telegram] Failed to preload dialogs", e);
      }
      // 4. Subscribe to updates (currently just a logger stub)
      this.subscribeToUpdates(accountId, resolvedUserId, client);

      // 5. Keep the client online
      await this.keepOnline(client);

      // 6. Store in maps
      this.clients.set(accountId, client);
      this.accountToUser.set(accountId, resolvedUserId);
      this.reconnectAttempts.set(accountId, 0);

      logger.info(
        `[TelegramClientManager] Attached Telegram client for account ${accountId} (user ${resolvedUserId})`
      );
    } catch (error) {
      logger.error(
        `[TelegramClientManager] Failed to connect Telegram client for account ${accountId}`,
        error!
      );
      // 7. Schedule automatic reconnect
      this.scheduleReconnect(accountId);
    }
  }

  // Attach and init clients for all active Telegram accounts of a given unimessenger user

  public async attachAllForUser(userId: string): Promise<void> {
    if (!API_ID || !API_HASH) return;
    logger.info(`[TelegramClientManager] attachAllForUser(${userId}) called`);
    // If we already initialized clients for this user during server lifetime - don't do it again
    if (this.initializedForUser.has(userId)) {
      return;
    }

    const accounts = await prisma.telegramAccount.findMany({
      where: {
        userId,
        isActive: true, // DB should have a field that shows the account is valid/authorized
      },
      include: {
        session: true, // assuming TelegramSession is linked as session
      },
    });

    if (!accounts.length) {
      // no active accounts - just mark that there's nothing to create for this user
      this.initializedForUser.add(userId);
      return;
    }

    for (const acc of accounts) {
      if (!acc.session || !acc.session.sessionString) {
        logger.warn(
          `[TelegramClientManager] User ${userId} account ${acc.id} has no session`
        );
        continue;
      }

      await this.attachAccount(acc.id, userId, acc.session.sessionString);
    }

    this.initializedForUser.add(userId);
  }

  // Detach a Telegram client for a specific Telegram account

  public async detachAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (!client) return;

    try {
      if (typeof (client as any).destroy === "function") {
        await (client as any).destroy();
      } else {
        (client as any)._destroyed = true;
        await client.disconnect();
      }
    } catch (err) {
      logger.warn(
        `[TelegramClientManager] Error while detaching account ${accountId}`,
        { err }
      );
    }

    this.clients.delete(accountId);
    this.accountToUser.delete(accountId);
    this.reconnectAttempts.delete(accountId);

    logger.info(
      `[TelegramClientManager] Detached Telegram client for account ${accountId}`
    );
  }

  // Detach all Telegram clients for a specific unimessenger user

  public async detachAllForUser(userId: string): Promise<void> {
    for (const [accountId, ownerId] of this.accountToUser.entries()) {
      if (ownerId === userId) {
        await this.detachAccount(accountId);
      }
    }

    this.initializedForUser.delete(userId);

    logger.info(
      `[TelegramClientManager] Detached all Telegram clients for user ${userId}`
    );
  }

  // Schedule a reconnect attempt for a specific Telegram account

  private scheduleReconnect(accountId: string): void {
    const attempts = (this.reconnectAttempts.get(accountId) || 0) + 1;

    if (attempts > this.maxReconnectAttempts) {
      logger.error(
        `[TelegramClientManager] Max reconnect attempts reached for account ${accountId}. Giving up.`
      );
      this.clients.delete(accountId);
      this.reconnectAttempts.delete(accountId);
      return;
    }

    this.reconnectAttempts.set(accountId, attempts);

    logger.info(
      `[TelegramClientManager] Scheduling reconnect #${attempts} for account ${accountId} in ${this.reconnectDelayMs}ms`
    );

    setTimeout(async () => {
      await this.attachAccount(accountId);
    }, this.reconnectDelayMs);
  }

  // Subscribe to Telegram updates for a specific account

  private subscribeToUpdates(
    accountId: string,
    userId: string,
    client: TelegramClient
  ): void {
    client.addEventHandler(async (event: any) => {
      const raw = event?.update ?? event;
      const className = raw?.className ?? raw?.constructor?.name;

      if (!className || className === "VirtualClass") return;

      if (isTelegramUpdateType(className)) {
        telegramUpdateHandlers[className]({ update: raw, accountId, userId });
      } else {
        logger.info(`[Unhandled Telegram update] ${className}\n`, raw);
      }
    });
  }

  // Ensure a Telegram client exists for a specific Telegram account

  private async ensureClient(accountId: string): Promise<TelegramClient> {
    const existing = this.clients.get(accountId);
    if (existing) {
      return existing;
    }

    // if not existing - try to attach
    await this.attachAccount(accountId);

    const created = this.clients.get(accountId);
    if (!created) {
      throw new Error(
        `[TelegramClientManager] Failed to initialize client for account ${accountId}`
      );
    }
    return created;
  }

  // Fetch dialogs for a specific Telegram account

  public async fetchDialogs(params: {
    accountId: string;
    limit?: number;
    offsetDate?: number;
    offsetId?: number;
    offsetPeer?:
      | { id: number; type: "user" | "chat" | "channel"; accessHash?: string }
      | undefined;
  }): Promise<TelegramGetDialogsResult> {
    const {
      accountId,
      limit = 50,
      offsetDate = 0,
      offsetId = 0,
      offsetPeer,
    } = params;

    const client = await this.ensureClient(accountId);

    // Prepare offsetPeer
    let peer: Api.TypeInputPeer;
    if (!offsetPeer) {
      peer = new Api.InputPeerEmpty();
    } else if (offsetPeer.type === "user") {
      peer = new Api.InputPeerUser({
        userId: bigInt(offsetPeer.id),
        accessHash: bigInt(Number(offsetPeer.accessHash ?? 0)),
      });
    } else if (offsetPeer.type === "chat") {
      peer = new Api.InputPeerChat({
        chatId: bigInt(offsetPeer.id),
      });
    } else {
      peer = new Api.InputPeerChannel({
        channelId: bigInt(offsetPeer.id),
        accessHash: bigInt(Number(offsetPeer.accessHash ?? 0)),
      });
    }

    const dialogsRes = await client.invoke(
      new Api.messages.GetDialogs({
        offsetDate,
        offsetId,
        offsetPeer: peer,
        limit,
      })
    );
    const { dialogs, nextOffset } = parseTelegramDialogs(dialogsRes, accountId);
    for (const dialog of dialogs) {
      if (dialog.lastMessage?.id) {
        await TelegramMessageIndexService.addIndex(
          accountId,
          dialog.lastMessage.id,
          dialog.chatId,
          dialog.lastMessage.date
            ? new Date(dialog.lastMessage.date)
            : undefined
        );
      }
    }
    return {
      status: "ok",
      dialogs,
      nextOffset,
    };
  }

  // Fully logout and clean up a Telegram account

  public async logoutAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      try {
        await client.invoke(new Api.auth.LogOut());
      } catch (err) {
        logger.warn(
          `[TelegramClientManager] MTProto logout failed for ${accountId}`,
          { error: String(err) }
        );
      }

      try {
        if (typeof (client as any).destroy === "function") {
          await (client as any).destroy();
        } else {
          (client as any)._destroyed = true;
          await client.disconnect();
        }
      } catch (err) {
        logger.warn(
          `[TelegramClientManager] destroy/disconnect error for ${accountId}`,
          { error: String(err) }
        );
      }
    }

    this.clients.delete(accountId);
    this.accountToUser.delete(accountId);
    this.reconnectAttempts.delete(accountId);

    await prisma.telegramSession.deleteMany({ where: { accountId } });
    await prisma.telegramAccount.updateMany({
      where: { id: accountId },
      data: { isActive: false },
    });

    logger.info(
      `[TelegramClientManager] Fully logged out and cleaned account ${accountId}`
    );
  }

  // Restore all active Telegram clients on server startup

  public async restoreActiveClients(): Promise<void> {
    try {
      const activeAccounts = await prisma.telegramAccount.findMany({
        where: { isActive: true },
        include: { session: true, user: true },
      });

      if (!activeAccounts.length) {
        logger.info(
          "[TelegramClientManager] No active Telegram accounts found at startup."
        );
        return;
      }

      logger.info(
        `[TelegramClientManager] Restoring ${activeAccounts.length} Telegram clients...`
      );

      for (const acc of activeAccounts) {
        if (!acc.session?.sessionString) {
          logger.warn(
            `[TelegramClientManager] Account ${acc.id} has no session string, skipping.`
          );
          continue;
        }

        await this.attachAccount(acc.id, acc.userId, acc.session.sessionString);
      }

      logger.info(
        "[TelegramClientManager] All active Telegram clients restored"
      );
    } catch (err) {
      logger.error("[TelegramClientManager] Failed to restore clients:", {
        err,
      });
    }
  }
  // Fetch message history for a specific chat in a Telegram account
  async fetchHistory({
    accountId,
    peerType,
    peerId,
    accessHash,
    limit = 50,
    offsetId = 0,
  }: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    peerId: string | number | bigint;
    accessHash?: string | number | bigint | null | undefined;
    limit?: number;
    offsetId?: number;
  }): Promise<Api.TypeMessage[]> {
    const client = await this.ensureClient(accountId);

    // 1. Peer building
    if (peerType !== "chat" && accessHash === undefined) {
      throw new Error("accessHash is required for user and channel peers");
    }

    const peer = resolveTelegramPeer(
      peerType,
      peerId,
      peerType === "chat" ? undefined : accessHash
    );

    // 2. Call API
    const history = await client.invoke(
      new Api.messages.GetHistory({
        peer,
        limit,
        offsetId,
      })
    );

    // 3. Extract all message types
    const rawMessages =
      history instanceof Api.messages.Messages ||
      history instanceof Api.messages.MessagesSlice ||
      history instanceof Api.messages.ChannelMessages
        ? history.messages
        : [];

    // 3.5. Save MessageID -> ChatID to database
    for (const msg of rawMessages) {
      if (msg instanceof Api.Message) {
        const messageId = msg.id?.toString();
        const chatId = peerId.toString(); // we fetched history for this chat

        if (messageId) {
          await TelegramMessageIndexService.addIndex(
            accountId,
            msg.id.toString(),
            chatId,
            new Date(msg.date * 1000),
            {
              rawPeerType:
                peerType === "user"
                  ? "user"
                  : peerType === "chat"
                  ? "chat"
                  : "channel",
              rawPeerId: String(peerId),
              rawAccessHash: accessHash ? String(accessHash) : null,
            }
          );
        }
      }
    }

    // 4. Do NOT filter them — return everything
    return rawMessages as Api.TypeMessage[];
  }

  //--------------------------------------------------------------
  // Client actions: send/edit/delete messages, typing, mark as read
  //--------------------------------------------------------------
  // Send message
  async sendMessage(
    accountId: string,
    chatId: string,
    text: string,
    tempId: string | number,
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    console.log("-----[TG SEND] Incoming data-----");
    console.log("accountId =", accountId);
    console.log("peerType  =", peerType);
    console.log("chatId    =", chatId);
    console.log("accessHash =", accessHash);
    console.log("text =", text);

    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    console.log("-----[TG SEND] Resolved Peer-----");
    console.log(peer);

    // store outgoing optimistic
    outgoingTempStore.set(accountId, tempId, text, chatId);

    // Send the message
    try {
      console.log("[MTProto] Invoking SendMessage RPC...");
      const result = await client.invoke(
        new Api.messages.SendMessage({ peer, message: text })
      );
      console.log("[MTProto] RPC RESULT:", result);
    } catch (err) {
      console.error("[MTProto] RPC FAILED:", err);
      throw err;
    }
  }

  // Delete messages
  async deleteMessages(
    accountId: string,
    chatId: string,
    messageIds: string[],
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    await client.invoke(
      new Api.messages.DeleteMessages({
        id: messageIds.map((id) => parseInt(id, 10)),
        revoke: true,
      })
    );

    // Save deletion info into DB index
    await TelegramMessageIndexService.markDeleted(accountId, messageIds);
  }

  // Start typing indicator
  async startTyping(
    accountId: string,
    chatId: string,
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    await client.invoke(
      new Api.messages.SetTyping({
        peer,
        action: new Api.SendMessageTypingAction(),
      })
    );
  }
  // Stop typing indicator
  async stopTyping(
    accountId: string,
    chatId: string,
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    await client.invoke(
      new Api.messages.SetTyping({
        peer,
        action: new Api.SendMessageCancelAction(),
      })
    );
  }

  // Mark messages as read up to a specific message ID
  async markAsRead(
    accountId: string,
    chatId: string,
    lastReadMessageId: string,
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    await client.invoke(
      new Api.messages.ReadHistory({
        peer,
        maxId: parseInt(lastReadMessageId, 10),
      })
    );
  }

  async editMessage(
    accountId: string,
    chatId: string,
    messageId: string,
    newText: string,
    peerType: "user" | "chat" | "channel" = "chat",
    accessHash?: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, chatId, accessHash);

    await client.invoke(
      new Api.messages.EditMessage({
        peer,
        id: parseInt(messageId, 10),
        message: newText,
      })
    );

    logger.info(
      `[TelegramClientManager] Edited message ${messageId} in chat ${chatId}`
    );
  }
}

const telegramClientManager = new TelegramClientManager();
export default telegramClientManager;
