// backend/services/telegramService.ts
import dotenv from "dotenv";
dotenv.config();

import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { prisma } from "../lib/prisma";
import { encryptSession } from "../utils/telegramSession";
const API_ID_RAW = process.env.TELEGRAM_API_ID;
const API_HASH = process.env.TELEGRAM_API_HASH;

if (!API_ID_RAW || !API_HASH) {
  throw new Error(
    "[TelegramService] TELEGRAM_API_ID or TELEGRAM_API_HASH is missing in .env"
  );
}

const API_ID = Number(API_ID_RAW);
if (!Number.isFinite(API_ID)) {
  throw new Error("[TelegramService] TELEGRAM_API_ID must be a number");
}

const CLIENT_OPTIONS = {
  connectionRetries: 5,
};

export class TelegramService {
  initClient(sessionString?: string) {
    const session = new StringSession(sessionString ?? "");
    const client = new TelegramClient(
      session,
      API_ID,
      API_HASH!,
      CLIENT_OPTIONS
    );
    return client;
  }

  async saveSession(
    userId: string,
    sessionString: string,
    telegramUser: Api.User
  ) {
    const encryptedSession = encryptSession(sessionString);

    const telegramId = telegramUser.id.toString();

    const existingAccount = await prisma.telegramAccount.findFirst({
      where: {
        userId: userId,
        telegramId: telegramId,
      },
    });

    if (existingAccount) {
      await prisma.telegramSession.create({
        data: {
          accountId: existingAccount.id,
          sessionString: encryptedSession,
        },
      });

      return {
        status: "session_updated",
        accountId: existingAccount.id,
      };
    } else {
      const newAccount = await prisma.telegramAccount.create({
        data: {
          userId: userId,
          telegramId: telegramId,
          phoneNumber: telegramUser.phone || null,
          username: telegramUser.username || null,
          sessions: {
            create: {
              sessionString: encryptedSession,
            },
          },
        },
        include: {
          sessions: true,
        },
      });

      return {
        status: "account_created",
        accountId: newAccount.id,
      };
    }
  }

  async sendCode(phoneNumber: string) {
    const client = this.initClient("");

    await client.connect();
    const res = await client.sendCode(
      {
        apiId: API_ID,
        apiHash: API_HASH!,
      },
      phoneNumber
    );

    return {
      status: "code_sent",
      phone_code_hash: res.phoneCodeHash,
    };
  }

  async signIn(params: {
    phoneNumber: string;
    phoneCode: string;
    phoneCodeHash: string;
  }) {
    const client = this.initClient("");
    await client.connect();

    try {
      const result = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: params.phoneNumber,
          phoneCodeHash: params.phoneCodeHash,
          phoneCode: params.phoneCode,
        })
      );

      const sessionString = client.session.save();
      const me = await client.getMe();

      return {
        status: "ok",
        sessionString,
        user: me,
      };
    } catch (err: any) {
      const msg = String(err?.message || err).toUpperCase();

      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        return { status: "need_password" };
      }
      if (msg.includes("PHONE_CODE_INVALID"))
        throw new Error("PHONE_CODE_INVALID");
      if (msg.includes("PHONE_CODE_EXPIRED"))
        throw new Error("PHONE_CODE_EXPIRED");

      throw err;
    }
  }

  async signInWithPassword(params: { password: string }) {
    const client = this.initClient("");

    await client.connect();

    try {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());

      if (!passwordInfo || !passwordInfo.currentAlgo) {
        throw new Error("PASSWORD_NOT_SET");
      }

      const { srpId, A, M1 } = await computeCheck(
        passwordInfo,
        params.password
      );

      const result = await client.invoke(
        new Api.auth.CheckPassword({
          password: new Api.InputCheckPasswordSRP({
            srpId,
            A,
            M1,
          }),
        })
      );

      const sessionString = client.session.save();
      const me = await client.getMe();

      return {
        status: "ok",
        sessionString,
        user: me,
      };
    } catch (err: any) {
      const msg = String(err?.message || err).toUpperCase();

      if (msg.includes("PASSWORD_HASH_INVALID")) {
        throw new Error("[TelegramService] PASSWORD_INVALID");
      }

      throw err;
    }
  }

  async logout(_accountId: string) {
    throw new Error("Not implemented yet");
  }
}
