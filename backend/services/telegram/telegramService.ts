// backend/services/telegram/TelegramService.ts
import dotenv from "dotenv";
dotenv.config();

import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { prisma } from "../../lib/prisma";
import { encryptSession, decryptSession } from "../../utils/telegramSession";
import { parseTelegramDialogs } from "../../utils/parseTelegramDialogs";
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

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH!;
const CLIENT_OPTIONS = { connectionRetries: 5 };

if (!API_ID || !API_HASH) {
  throw new Error(
    "[TelegramService] TELEGRAM_API_ID or TELEGRAM_API_HASH missing"
  );
}

export class TelegramService {
  /** ────────────── HELPERS ────────────── */
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
    console.error(`[TelegramService:${ctx}]`, err?.message || err);
  }

  /** ────────────── AUTH ────────────── */
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
        console.warn("[TelegramService] destroy/disconnect failed", e);
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
        console.warn("[TelegramService] destroy/disconnect failed", e);
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
        console.warn("[TelegramService] destroy/disconnect failed", e);
      }
    }
  }

  /** ────────────── SESSION ────────────── */
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

  /** ────────────── DATA ────────────── */
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
}
