import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { prisma } from "../../lib/prisma";
import { decryptSession } from "../../utils/telegram/telegramSession";
import { logger } from "../../utils/logger";
import { Api } from "telegram";
import bigInt from "big-integer";
import { parseTelegramDialogs } from "../../utils/telegram/parseTelegramDialogs";
import { resolveTelegramPeer } from "../../utils/telegram/resolveTelegramPeer";
import type { TelegramGetDialogsResult } from "../../types/telegram.types";
import { Raw } from "telegram/events/Raw";
import { EditedMessage } from "telegram/events/EditedMessage";
import { NewMessage } from "telegram/events/NewMessage";
import { onNewMessage } from "../../realtime/handlers/telegram/onNewMessage";
import { onRawUpdate } from "../../realtime/handlers/telegram/onRawUpdate";
import { onEditedMessage } from "../../realtime/handlers/telegram/onEditedMessage";
import { TelegramMessageIndexService } from "./telegramMessageIndexService";
import { CustomFile } from "telegram/client/uploads";
import { appendLog } from "../../utils/debugLogger";
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
  private clients = new Map<string, TelegramClient>();
  private accountToUser = new Map<string, string>();
  private initializedForUser = new Set<string>();
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 5_000;
  private userCache = new Map<string, Map<number, Api.User>>();
  private chatCache = new Map<string, Map<number, Api.TypeChat>>();

  public getClient(accountId: string): TelegramClient | undefined {
    return this.clients.get(accountId);
  }

  public isClientActive(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  public async keepOnline(client: TelegramClient) {
    try {
      if (client.connected) {
        await client.invoke(new Api.account.UpdateStatus({ offline: false }));
        logger.info("[Telegram] Client is now ONLINE");
      }

      setInterval(async () => {
        try {
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

  public async attachAccount(
    accountId: string,
    userId?: string,
    encryptedSession?: string
  ): Promise<void> {
    if (!API_ID || !API_HASH) return;

    if (this.clients.has(accountId)) {
      logger.warn(
        `[TelegramClientManager] Client already exists for account ${accountId}, skipping`
      );
      return;
    }

    let sessionString = encryptedSession;
    let resolvedUserId = userId;

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

    const decrypted = decryptSession(sessionString);
    const stringSession = new StringSession(decrypted);

    const client = new TelegramClient(stringSession, API_ID!, API_HASH!, {
      connectionRetries: 5,
    });

    try {
      await client.connect();
      await client.getMe();
      try {
        const dialogsRaw = await client.invoke(
          new Api.messages.GetDialogs({
            limit: 200,
            offsetPeer: new Api.InputPeerEmpty(),
          })
        );

        // Must check the exact MTProto type
        if (
          dialogsRaw instanceof Api.messages.Dialogs ||
          dialogsRaw instanceof Api.messages.DialogsSlice
        ) {
          this.storeEntities(
            accountId,
            dialogsRaw.users ?? [],
            dialogsRaw.chats ?? []
          );

          console.log("[Telegram] Dialogs preload done");
        } else {
          console.warn(
            `[Telegram] Dialogs preload returned DialogsNotModified — no users/chats`
          );
        }
      } catch (e) {
        console.warn("[Telegram] Failed to preload dialogs", e);
      }

      this.subscribeToUpdates(accountId, resolvedUserId, client);

      await this.keepOnline(client);

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
      this.scheduleReconnect(accountId);
    }
  }

  public async attachAllForUser(userId: string): Promise<void> {
    if (!API_ID || !API_HASH) return;

    if (this.initializedForUser.has(userId)) {
      return;
    }

    const accounts = await prisma.telegramAccount.findMany({
      where: { userId, isActive: true },
      include: { session: true },
    });

    if (!accounts.length) {
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

  private subscribeToUpdates(
    accountId: string,
    userId: string,
    client: TelegramClient
  ): void {
    // HIGH-LEVEL NEW MESSAGE
    client.addEventHandler(async (event) => {
      console.log("[HL NEW] Incoming NewMessage event");
      try {
        await onNewMessage(event, accountId, userId);
      } catch (err) {
        console.error("[HL NEW ERROR]", err);
      }
    }, new NewMessage({}));

    client.addEventHandler(async (event) => {
      console.log("[HL EDIT] Incoming EditedMessage event");
      try {
        await onEditedMessage(event, accountId, userId);
      } catch (err) {
        console.error("[HL EDIT ERROR]", err);
      }
    }, new EditedMessage({}));

    client.addEventHandler(async (event) => {
      const raw = event?.update ?? event;
      const name = raw?.className ?? raw?.constructor?.name;
      // console.log("[RAW] Incoming Raw update:", name);

      try {
        await onRawUpdate(event, accountId, userId);
      } catch (err) {
        console.error("[RAW ERROR]", err);
      }
    }, new Raw({}));

    console.log(
      `[subscribeToUpdates] Handlers attached! acc=${accountId} user=${userId}`
    );
  }
  private async ensureClient(accountId: string): Promise<TelegramClient> {
    const existing = this.clients.get(accountId);
    if (existing) {
      return existing;
    }

    await this.attachAccount(accountId);

    const created = this.clients.get(accountId);
    if (!created) {
      throw new Error(
        `[TelegramClientManager] Failed to initialize client for account ${accountId}`
      );
    }
    return created;
  }

  public resolveSenderEntity(
    accountId: string,
    peer: Api.TypePeer | null | undefined
  ): Api.User | Api.TypeChat | null {
    if (!peer) return null;

    const users = this.userCache.get(accountId);
    const chats = this.chatCache.get(accountId);

    if (peer instanceof Api.PeerUser && users) {
      return users.get(Number(peer.userId)) ?? null;
    }
    if (peer instanceof Api.PeerChat && chats) {
      return chats.get(Number(peer.chatId)) ?? null;
    }
    if (peer instanceof Api.PeerChannel && chats) {
      return chats.get(Number(peer.channelId)) ?? null;
    }
    return null;
  }

  private storeEntities(
    accountId: string,
    users: Api.TypeUser[],
    chats: Api.TypeChat[]
  ) {
    if (!this.userCache.has(accountId)) {
      this.userCache.set(accountId, new Map());
    }
    if (!this.chatCache.has(accountId)) {
      this.chatCache.set(accountId, new Map());
    }

    const userMap = this.userCache.get(accountId)!;
    const chatMap = this.chatCache.get(accountId)!;

    for (const u of users) {
      if (u instanceof Api.User) {
        userMap.set(Number(u.id), u);
      }
    }

    for (const c of chats) {
      chatMap.set(Number(c.id), c);
    }
  }

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

    return { status: "ok", dialogs, nextOffset };
  }

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

    if (peerType !== "chat" && accessHash === undefined) {
      throw new Error("accessHash is required for user and channel peers");
    }

    const peer = resolveTelegramPeer(
      peerType,
      peerId,
      peerType === "chat" ? undefined : accessHash
    );

    const history = await client.invoke(
      new Api.messages.GetHistory({
        peer,
        limit,
        offsetId,
      })
    );

    const rawMessages =
      history instanceof Api.messages.Messages ||
      history instanceof Api.messages.MessagesSlice ||
      history instanceof Api.messages.ChannelMessages
        ? history.messages
        : [];

    for (const msg of rawMessages) {
      if (msg instanceof Api.Message) {
        const messageId = msg.id?.toString();
        const chatId = peerId.toString();

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

    return rawMessages as Api.TypeMessage[];
  }
  /* ============================================================
     SEND TEXT
  ============================================================ */
  public async sendText(
    accountId: string,
    peerType: "user" | "chat" | "channel",
    peerId: string | number | bigint,
    accessHash: string | number | bigint | null,
    text: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, peerId, accessHash);

    logger.info("[sendText] Sending text", {
      accountId,
      peerType,
      peerId: String(peerId),
      textLength: text.length,
    });

    const sent = await client.sendMessage(peer, { message: text });

    appendLog("SENT_TEXT_RAW", sent);

    return {
      id: sent.id,
      date: sent.date * 1000,
      raw: sent,
    };
  }

  /* ============================================================
     GENERIC MEDIA
  ============================================================ */
  public async sendMedia(
    accountId: string,
    peerType: "user" | "chat" | "channel",
    peerId: string | number | bigint,
    accessHash: string | number | bigint | null,
    fileBuf: Buffer,
    fileName: string,
    text: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, peerId, accessHash);

    logger.info("[sendMedia] Uploading file", {
      accountId,
      peerType,
      peerId: String(peerId),
      fileName,
      fileSize: fileBuf.length,
      captionLength: text.length,
    });

    const uploaded = await client.uploadFile({
      workers: 1,
      file: new CustomFile(fileName, fileBuf.length, fileName, fileBuf),
    });

    logger.info("[sendMedia] Uploaded, sending…");

    const sent = await client.sendFile(peer, {
      file: uploaded,
      caption: text || "",
    });

    appendLog("SENT_MEDIA_RAW", sent);

    return {
      id: sent.id,
      date: sent.date * 1000,
      raw: sent,
    };
  }

  /* ============================================================
     SEND VOICE (voice note)
  ============================================================ */
  public async sendVoice(
    accountId: string,
    peerType: "user" | "chat" | "channel",
    peerId: string | number | bigint,
    accessHash: string | number | bigint | null,
    fileBuf: Buffer,
    fileName: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, peerId, accessHash);

    logger.info("[sendVoice] Uploading", {
      accountId,
      peerType,
      peerId: String(peerId),
      fileName,
      fileSize: fileBuf.length,
    });

    const uploaded = await client.uploadFile({
      workers: 1,
      file: new CustomFile(fileName, fileBuf.length, fileName, fileBuf),
    });

    logger.info("[sendVoice] Uploaded, sending as voiceNote");

    const sent = await client.sendFile(peer, {
      file: uploaded,
      voiceNote: true,
    });

    appendLog("SENT_VOICE_RAW", sent);

    return {
      id: sent.id,
      date: sent.date * 1000,
      raw: sent,
    };
  }

  /* ============================================================
     SEND VIDEO NOTE (round video)
  ============================================================ */
  public async sendVideoNote(
    accountId: string,
    peerType: "user" | "chat" | "channel",
    peerId: string | number | bigint,
    accessHash: string | number | bigint | null,
    fileBuf: Buffer,
    fileName: string
  ) {
    const client = await this.ensureClient(accountId);
    const peer = resolveTelegramPeer(peerType, peerId, accessHash);

    logger.info("[sendVideoNote] Uploading", {
      accountId,
      peerType,
      peerId: String(peerId),
      fileName,
      fileSize: fileBuf.length,
    });

    const uploaded = await client.uploadFile({
      workers: 1,
      file: new CustomFile(fileName, fileBuf.length, fileName, fileBuf),
    });

    logger.info("[sendVideoNote] Uploaded, sending as round video note");

    const sent = await client.sendFile(peer, {
      file: uploaded,
      videoNote: true,
    });

    appendLog("SENT_VIDEO_NOTE_RAW", sent);

    return {
      id: sent.id,
      date: sent.date * 1000,
      raw: sent,
    };
  }

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
