// backend/services/telegramService.ts
import dotenv from "dotenv";
dotenv.config();

import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { prisma } from "../lib/prisma";
import { encryptSession, decryptSession } from "../utils/telegramSession";

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH!;
if (!API_ID || !API_HASH) {
  throw new Error(
    "[TelegramService] TELEGRAM_API_ID or TELEGRAM_API_HASH missing"
  );
}

const CLIENT_OPTIONS = { connectionRetries: 5 };

export class TelegramService {
  initClient(sessionString?: string) {
    return new TelegramClient(
      new StringSession(sessionString ?? ""),
      API_ID,
      API_HASH,
      CLIENT_OPTIONS
    );
  }

  async sendCode(phoneNumber: string) {
    const client = this.initClient();
    await client.connect();
    const res = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );
    return {
      status: "code_sent",
      phoneCodeHash: res.phoneCodeHash,
      tempSession: client.session.save(),
    };
  }

  async signIn(params: {
    phoneNumber: string;
    phoneCode: string;
    phoneCodeHash: string;
    tempSession: string;
  }) {
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
        sessionString: client.session.save(),
        user: await client.getMe(),
      };
    } catch (err: any) {
      if (
        String(err.message || err)
          .toUpperCase()
          .includes("SESSION_PASSWORD_NEEDED")
      ) {
        return { status: "need_password", tempSession: client.session.save() };
      }
      throw err;
    }
  }

  async signInWithPassword(params: { password: string; tempSession: string }) {
    const client = this.initClient(params.tempSession);
    await client.connect();

    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const { srpId, A, M1 } = await computeCheck(passwordInfo, params.password);

    await client.invoke(
      new Api.auth.CheckPassword({
        password: new Api.InputCheckPasswordSRP({ srpId, A, M1 }),
      })
    );

    return {
      status: "ok",
      sessionString: client.session.save(),
      user: await client.getMe(),
    };
  }

  async saveSession(
    userId: string,
    sessionString: string,
    telegramUser: Api.User
  ) {
    const encrypted = encryptSession(sessionString);
    const telegramId = telegramUser.id.toString();

    let account = await prisma.telegramAccount.findUnique({
      where: { telegramId },
    });

    if (!account) {
      account = await prisma.telegramAccount.create({
        data: {
          userId,
          telegramId,
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
      return { status: "account_created", accountId: account.id };
    } else {
      await prisma.telegramAccount.update({
        where: { id: account.id },
        data: {
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
    }
  }

  async logout(accountId: string) {
    const session = await prisma.telegramSession.findUnique({
      where: { accountId },
    });
    if (!session) return { status: "ok" };

    const client = this.initClient(decryptSession(session.sessionString));
    try {
      await client.connect();
      await client.invoke(new Api.auth.LogOut());
    } catch {}

    await prisma.telegramSession.delete({ where: { accountId } });
    await prisma.telegramAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return { status: "ok" };
  }

  async getAccounts(userId: string) {
    const accounts = await prisma.telegramAccount.findMany({
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
    return accounts;
  }
}
