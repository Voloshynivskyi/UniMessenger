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
import fs from "fs";
import path from "path";
import { Raw } from "telegram/events/Raw";
import { EditedMessage } from "telegram/events/EditedMessage";
import { NewMessage } from "telegram/events/NewMessage";
import type { UnifiedTelegramMessageType } from "../../types/telegram.types";
import { onNewMessage } from "../../realtime/handlers/onNewMessage";
import { onRawUpdate } from "../../realtime/handlers/onRawUpdate";
import { onEditedMessage } from "../../realtime/handlers/onEditedMessage";
import { TelegramMessageIndexService } from "./telegramMessageIndexService";
import { outgoingTempStore } from "../../realtime/outgoingTempStore";
import { CustomFile } from "telegram/client/uploads";
import type { TelegramOutgoingMedia } from "../../realtime/events";

const API_ID = process.env.TELEGRAM_API_ID
  ? Number(process.env.TELEGRAM_API_ID)
  : undefined;
const API_HASH = process.env.TELEGRAM_API_HASH;

if (!API_ID || !API_HASH) {
  logger.warn(
    "[TelegramClientManager] TELEGRAM_API_ID or TELEGRAM_API_HASH is not set. Telegram clients will not work correctly."
  );
}
// helper
function buildInputMediaForOutgoing(
  mediaMeta: TelegramOutgoingMedia,
  uploaded: Api.TypeInputFile
): Api.TypeInputMedia {
  const mime = mediaMeta.mime || "application/octet-stream";

  const isImage = mime.startsWith("image/");
  const isGif = mime === "image/gif";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf";

  const isJpeg =
    mime === "image/jpeg" || mime === "image/jpg" || mime === "image/pjpeg";
  const isPng = mime === "image/png";
  const isClassicPhoto = isJpeg || isPng; // тільки ці формати шлемо як photo

  const fileNameForUser =
    mediaMeta.originalName || mediaMeta.fileName || mediaMeta.fileId;

  // 1) PHOTO → справжнє фото-бабл у Telegram (тільки JPEG / PNG)
  if (mediaMeta.type === "photo" && isImage && !isGif && isClassicPhoto) {
    return new Api.InputMediaUploadedPhoto({
      file: uploaded,
    });
  }

  // 2) VIDEO
  if (mediaMeta.type === "video") {
    const attributes: Api.TypeDocumentAttribute[] = [
      new Api.DocumentAttributeVideo({
        duration: 0,
        w: 0,
        h: 0,
        supportsStreaming: true,
      }),
      new Api.DocumentAttributeFilename({
        fileName: fileNameForUser,
      }),
    ];

    return new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: mime,
      attributes,
    });
  }

  // 3) VOICE
  if (mediaMeta.type === "voice") {
    const attributes: Api.TypeDocumentAttribute[] = [
      new Api.DocumentAttributeAudio({
        duration: 0,
        voice: true,
      }),
      new Api.DocumentAttributeFilename({
        fileName: fileNameForUser,
      }),
    ];

    return new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: mime || "audio/ogg",
      attributes,
    });
  }

  // 4) AUDIO
  if (mediaMeta.type === "audio") {
    const attributes: Api.TypeDocumentAttribute[] = [
      new Api.DocumentAttributeAudio({
        duration: 0,
        voice: false,
      }),
      new Api.DocumentAttributeFilename({
        fileName: fileNameForUser,
      }),
    ];

    return new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: mime,
      attributes,
    });
  }

  // 5) ANIMATION / GIF
  if (mediaMeta.type === "animation" || isGif) {
    const attributes: Api.TypeDocumentAttribute[] = [
      new Api.DocumentAttributeAnimated(),
      new Api.DocumentAttributeFilename({
        fileName: fileNameForUser,
      }),
    ];

    return new Api.InputMediaUploadedDocument({
      file: uploaded,
      mimeType: mime || "image/gif",
      attributes,
    });
  }

  // 6) ВСЕ ІНШЕ → DOCUMENT (PDF, WEBP, ZIP, VBP, PY, DOCX, …)
  const attributes: Api.TypeDocumentAttribute[] = [
    new Api.DocumentAttributeFilename({
      fileName: fileNameForUser,
    }),
  ];

  return new Api.InputMediaUploadedDocument({
    file: uploaded,
    mimeType: mime || (isPdf ? "application/pdf" : "application/octet-stream"),
    attributes,
  });
}

export class TelegramClientManager {
  private clients = new Map<string, TelegramClient>();
  private accountToUser = new Map<string, string>();
  private initializedForUser = new Set<string>();
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 5_000;

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
        await client.getDialogs({ limit: 200 });
        console.log("[Telegram] Dialogs preload done");
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
    /** ───────────────────────────────────────────────
     * HIGH-LEVEL NEW MESSAGE
     * ─────────────────────────────────────────────── */
    client.addEventHandler(async (event) => {
      console.log("[HL NEW] Incoming NewMessage event");
      try {
        await onNewMessage(event, accountId, userId);
      } catch (err) {
        console.error("[HL NEW ERROR]", err);
      }
    }, new NewMessage({}));

    /** ───────────────────────────────────────────────
     * HIGH-LEVEL EDITED MESSAGE
     * ─────────────────────────────────────────────── */
    client.addEventHandler(async (event) => {
      console.log("[HL EDIT] Incoming EditedMessage event");
      try {
        await onEditedMessage(event, accountId, userId);
      } catch (err) {
        console.error("[HL EDIT ERROR]", err);
      }
    }, new EditedMessage({}));

    /** ───────────────────────────────────────────────
     * RAW UPDATES — only non-message stuff
     * (delete, typing, read, pinned, views, status)
     * ─────────────────────────────────────────────── */
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
  async sendMessageOrMedia(
    accountId: string,
    chatId: string,
    tempId: string | number,
    payload: {
      text?: string;
      media?: TelegramOutgoingMedia;
      peerType?: "user" | "chat" | "channel";
      accessHash?: string;
      replyToMessageId?: string;
    }
  ): Promise<void> {
    const client = await this.ensureClient(accountId);

    // ─────────────────────────────────────────────
    // Resolve peer
    // ─────────────────────────────────────────────
    const peer = resolveTelegramPeer(
      payload.peerType ?? "chat",
      chatId,
      payload.accessHash
    );

    // ─────────────────────────────────────────────
    // Register temp message (optimistic UI)
    // ─────────────────────────────────────────────
    outgoingTempStore.push(accountId, chatId, {
      tempId,
      chatId,
      createdAt: Date.now(),
    });

    logger.info(
      `[ClientManager] Outgoing temp registered: acc=${accountId}, chat=${chatId}, tempId=${tempId}`
    );

    // ─────────────────────────────────────────────
    // TEXT-ONLY MESSAGE
    // ─────────────────────────────────────────────
    if (!payload.media) {
      const msgParams: any = {
        message: payload.text ?? "",
      };

      if (payload.replyToMessageId) {
        msgParams.replyTo = Number(payload.replyToMessageId);
      }

      await client.sendMessage(peer, msgParams);

      logger.info(
        `[ClientManager] Sent TEXT: acc=${accountId} chat=${chatId} tempId=${tempId}`
      );
      return;
    }

    // ─────────────────────────────────────────────
    // MEDIA MESSAGE
    // ─────────────────────────────────────────────
    const mediaMeta = payload.media;

    // ВАЖЛИВО: для диска використовуємо ТІЛЬКИ технічне імʼя,
    // яке повернув upload endpoint (stored-media/telegram-outgoing/...).
    const storedFileName = mediaMeta.fileName ?? mediaMeta.fileId;

    const mediaPath = path.join(
      process.cwd(),
      "stored-media",
      "telegram-outgoing",
      accountId,
      storedFileName
    );

    if (!fs.existsSync(mediaPath)) {
      logger.error(
        `[ClientManager] MEDIA NOT FOUND at ${mediaPath} (acc=${accountId}, chat=${chatId}, tempId=${tempId})`
      );
      throw new Error("Local media file not found");
    }

    const fileBuffer = fs.readFileSync(mediaPath);
    const fileSize = fileBuffer.length;

    logger.info(
      `[ClientManager] Uploading file via MTProto → ${storedFileName}, mime=${mediaMeta.mime}, type=${mediaMeta.type}`
    );

    // 1) Upload через client.uploadFile
    const uploaded = await client.uploadFile({
      file: new CustomFile(storedFileName, fileSize, "", fileBuffer),
      workers: 1,
    });
    // uploaded: Api.TypeInputFile

    // 2) Будуємо InputMedia, виходячи тільки з mime + type + originalName
    const inputMedia = buildInputMediaForOutgoing(mediaMeta, uploaded);

    // 3) Формуємо аргументи для Api.messages.SendMedia
    const randomId = bigInt(
      Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
    );

    const sendArgs: any = {
      peer,
      media: inputMedia,
      message: payload.text ?? "",
      randomId,
    };

    if (payload.replyToMessageId) {
      sendArgs.replyTo = new Api.InputReplyToMessage({
        replyToMsgId: Number(payload.replyToMessageId),
      });
    }

    logger.info("[ClientManager] Calling Api.messages.SendMedia…");

    try {
      await client.invoke(new Api.messages.SendMedia(sendArgs));

      logger.info(
        `[ClientManager] Sent MEDIA OK: acc=${accountId}, chat=${chatId}, tempId=${tempId}`
      );
    } catch (err: any) {
      logger.error(
        `[ClientManager] SendMedia FAILED: acc=${accountId}, chat=${chatId}, tempId=${tempId}`,
        { error: String(err) }
      );
      throw err;
    }
  }

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

    await TelegramMessageIndexService.markDeleted(accountId, messageIds);
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
