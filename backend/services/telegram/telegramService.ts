// backend/services/telegram/TelegramService.ts
import dotenv from "dotenv";
dotenv.config();
import { Api, Logger, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { prisma } from "../../lib/prisma";
import { encryptSession, decryptSession } from "../../utils/telegram/telegramSession";
import { parseTelegramDialogs } from "../../utils/telegram/parseTelegramDialogs";
import type {
  TelegramSendCodeResult,
  TelegramSignInOkResult,
  TelegramSignInNeedPasswordResult,
  TelegramSignInWithPasswordResult,
  TelegramSaveSessionResult,
  TelegramLogoutResult,
  TelegramAccountInfo,
  TelegramGetDialogsResult,
} from "../../types/telegram.types";
import bigInt from "big-integer";
import telegramClientManager from "./telegramClientManager";
import { logger } from "../../utils/logger";
import { parseTelegramMessage } from "../../utils/telegram/parseTelegramMessage";
import { appendLog } from "../../utils/debugLogger";
import {
  convertWebmVideoToMp4Note,
  convertWebmVoiceToOgg,
} from "../../utils/mediaConverter";

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH!;
const CLIENT_OPTIONS = { connectionRetries: 5 };

if (!API_ID || !API_HASH) {
  throw new Error(
    "[TelegramService] TELEGRAM_API_ID or TELEGRAM_API_HASH missing"
  );
}

export class TelegramService {
  // Helper methods
  private initClient(sessionString?: string) {
    return new TelegramClient(
      new StringSession(sessionString ?? ""),
      API_ID,
      API_HASH,
      CLIENT_OPTIONS
    );
  }

  private async getSession(accountId: string) {
    const s = await prisma.telegramSession.findUnique({ where: { accountId } });
    if (!s) throw new Error("Telegram session not found");
    return decryptSession(s.sessionString);
  }

  private logError(ctx: string, err: any) {
    logger.error(`[TelegramService:${ctx}]`, err?.message || err);
  }

  // Authentication methods
  async sendCode(phoneNumber: string): Promise<TelegramSendCodeResult> {
    const client = this.initClient();
    await client.connect();

    try {
      const res = await client.sendCode(
        { apiId: API_ID, apiHash: API_HASH },
        phoneNumber
      );
      return {
        status: "code_sent",
        phoneCodeHash: res.phoneCodeHash,
        tempSession: client.session.save()!,
      };
    } catch (error) {
      this.logError("sendCode", error);
      throw error; // 👈 MTProto errors go up
    } finally {
      try {
        if (typeof (client as any).destroy === "function") {
          await (client as any).destroy();
        } else {
          (client as any)._destroyed = true;
          await client.disconnect();
        }
      } catch (e) {
        logger.warn("[TelegramService] destroy/disconnect failed", { e });
      }
    }
  }

  async signIn(params: {
    phoneNumber: string;
    phoneCode: string;
    phoneCodeHash: string;
    tempSession: string;
  }): Promise<TelegramSignInOkResult | TelegramSignInNeedPasswordResult> {
    const client = this.initClient(params.tempSession);
    await client.connect();

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: params.phoneNumber,
          phoneCodeHash: params.phoneCodeHash,
          phoneCode: params.phoneCode,
        })
      );

      return {
        status: "ok",
        sessionString: client.session.save()!,
        user: (await client.getMe()) as Api.User,
      };
    } catch (error: any) {
      const msg = String(error?.message || "").toUpperCase();
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        return { status: "need_password", tempSession: client.session.save()! };
      }
      this.logError("signIn", error);
      throw error;
    } finally {
      try {
        if (typeof (client as any).destroy === "function") {
          await (client as any).destroy();
        } else {
          (client as any)._destroyed = true;
          await client.disconnect();
        }
      } catch (e) {
        logger.warn("[TelegramService] destroy/disconnect failed", { e });
      }
    }
  }

  async signInWithPassword(params: {
    password: string;
    tempSession: string;
  }): Promise<TelegramSignInWithPasswordResult> {
    const client = this.initClient(params.tempSession);
    await client.connect();

    try {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());
      const { srpId, A, M1 } = await computeCheck(
        passwordInfo,
        params.password
      );

      await client.invoke(
        new Api.auth.CheckPassword({
          password: new Api.InputCheckPasswordSRP({ srpId, A, M1 }),
        })
      );

      return {
        status: "ok",
        sessionString: client.session.save()!,
        user: (await client.getMe()) as Api.User,
      };
    } catch (error) {
      this.logError("signInWithPassword", error);
      throw error;
    } finally {
      try {
        if (typeof (client as any).destroy === "function") {
          await (client as any).destroy();
        } else {
          (client as any)._destroyed = true;
          await client.disconnect();
        }
      } catch (e) {
        logger.warn("[TelegramService] destroy/disconnect failed", { e });
      }
    }
  }

  // Session management
  async saveSession(
    userId: string,
    sessionString: string,
    telegramUser: Api.User
  ): Promise<TelegramSaveSessionResult> {
    const encrypted = encryptSession(sessionString);
    const telegramId = telegramUser.id.toString();

    try {
      const account = await prisma.telegramAccount.upsert({
        where: { telegramId },
        create: {
          userId,
          telegramId,
          phoneNumber: telegramUser.phone ?? null,
          username: telegramUser.username ?? null,
          firstName: telegramUser.firstName ?? null,
          lastName: telegramUser.lastName ?? null,
          isActive: true,
        },
        update: {
          phoneNumber: telegramUser.phone ?? null,
          username: telegramUser.username ?? null,
          firstName: telegramUser.firstName ?? null,
          lastName: telegramUser.lastName ?? null,
          isActive: true,
        },
      });

      await prisma.telegramSession.upsert({
        where: { accountId: account.id },
        create: { accountId: account.id, sessionString: encrypted },
        update: { sessionString: encrypted },
      });

      return { status: "session_replaced", accountId: account.id };
    } catch (error) {
      this.logError("saveSession", error);
      throw error;
    }
  }

  async logout(accountId: string): Promise<TelegramLogoutResult> {
    await telegramClientManager.logoutAccount(accountId);
    return { status: "ok" };
  }

  // Data retrieval methods
  async getAccounts(userId: string): Promise<TelegramAccountInfo[]> {
    try {
      return await prisma.telegramAccount.findMany({
        where: { userId },
        select: {
          id: true,
          telegramId: true,
          username: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.logError("getAccounts", error);
      throw error;
    }
  }

  async getDialogs(params: {
    accountId: string;
    limit?: number;
    offsetDate?: number;
    offsetId?: number;
    offsetPeer?:
      | {
          id: number;
          type: "user" | "chat" | "channel";
          accessHash?: string;
        }
      | undefined;
  }): Promise<TelegramGetDialogsResult> {
    return telegramClientManager.fetchDialogs(params);
  }

  async getChatHistory({
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
    accessHash?: string | number | bigint | null;
    limit?: number;
    offsetId?: number;
  }) {
    // Validate accessHash for user/channel peers
    if (peerType !== "chat" && accessHash == null) {
      throw new Error("accessHash is required for user and channel peers");
    }

    // 1. Fetch raw MTProto messages
    const rawMessages = await telegramClientManager.fetchHistory({
      accountId,
      peerType,
      peerId,
      accessHash,
      limit,
      offsetId,
    });

    // 2. Parse + inject senderEntity (fix history names)
    const parsedMessages = rawMessages.map((msg) => {
      const parsed = parseTelegramMessage(msg, accountId);

      if (msg instanceof Api.Message) {
        const senderPeer = msg.fromId ?? msg.peerId;

        if (senderPeer) {
          const senderEntity = telegramClientManager.resolveSenderEntity(
            accountId,
            senderPeer
          );

          if (senderEntity) {
            let name = "Unknown";

            if (senderEntity instanceof Api.User) {
              const first = senderEntity.firstName ?? "";
              const last = senderEntity.lastName ?? "";
              name =
                `${first} ${last}`.trim() || senderEntity.username || "Unknown";
            } else if (
              senderEntity instanceof Api.Chat ||
              senderEntity instanceof Api.Channel
            ) {
              name = senderEntity.title ?? "Unknown";
            }

            let photoId: string | null = null;

            if (
              senderEntity &&
              "photo" in senderEntity &&
              senderEntity.photo &&
              "photoId" in senderEntity.photo
            ) {
              photoId = senderEntity.photo.photoId?.toString?.() ?? null;
            }

            parsed.from = {
              id: parsed.from?.id ?? String(senderEntity.id),
              name,
              username:
                senderEntity instanceof Api.User
                  ? senderEntity.username ?? null
                  : null,
              photoId,
            };
          }
        }
      }

      return parsed;
    });

    const lastMessage = rawMessages.length
      ? rawMessages[rawMessages.length - 1]
      : null;

    return {
      status: "ok",
      rawMessages,
      messages: parsedMessages,
      nextOffsetId: lastMessage ? Number(lastMessage.id) : null,
    };
  }

  async sendUnified(params: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    peerId: string | number | bigint;
    accessHash?: string | number | bigint | null;
    text?: string;
    fileBuffer?: Buffer;
    fileName?: string;
    mediaKind?: "file" | "voice" | "video_note";
  }) {
    const {
      accountId,
      peerType,
      peerId,
      accessHash = null,
      text = "",
      fileBuffer,
      fileName,
      mediaKind,
    } = params;

    logger.info("[telegramService.sendUnified] Called", {
      accountId,
      peerType,
      peerId: String(peerId),
      hasFile: !!fileBuffer,
      fileName,
      mediaKind,
      textLength: text.length,
    });

    // 1) No file → pure text
    if (!fileBuffer || !fileName) {
      logger.info("[telegramService.sendUnified] Text-only branch");
      return telegramClientManager.sendText(
        accountId,
        peerType,
        peerId,
        accessHash,
        text
      );
    }

    // 2) Voice: webm → ogg opus
    if (mediaKind === "voice") {
      logger.info(
        "[telegramService.sendUnified] Voice branch (convert webm → ogg)"
      );
      const { buffer: oggBuf, fileName: oggFileName } =
        await convertWebmVoiceToOgg(fileBuffer);

      return telegramClientManager.sendVoice(
        accountId,
        peerType,
        peerId,
        accessHash,
        oggBuf,
        oggFileName
      );
    }

    // 3) Video note: webm → mp4 square
    if (mediaKind === "video_note") {
      logger.info(
        "[telegramService.sendUnified] Video note branch (try convert webm → mp4)"
      );

      try {
        const { buffer: mp4Buf, fileName: mp4FileName } =
          await convertWebmVideoToMp4Note(fileBuffer);

        logger.info(
          "[telegramService.sendUnified] Video note converted successfully, sending MP4"
        );

        return telegramClientManager.sendVideoNote(
          accountId,
          peerType,
          peerId,
          accessHash,
          mp4Buf,
          mp4FileName
        );
      } catch (convErr) {
        logger.error("[sendUnified] Video note conversion FAILED", { convErr });
        throw convErr; // NO FALLBACK
      }
    }

    // 4) Default — regular media/file as is
    logger.info("[telegramService.sendUnified] Generic media branch");
    return telegramClientManager.sendMedia(
      accountId,
      peerType,
      peerId,
      accessHash,
      fileBuffer,
      fileName,
      text
    );
  }
}
