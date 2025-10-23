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

/** Result type returned by `sendCode` on success. */
export interface TelegramSendCodeResult {
  status: "code_sent";
  phoneCodeHash: string;
  tempSession: string;
}

/** Result type returned by `signIn` when password is NOT required. */
export interface TelegramSignInOkResult {
  status: "ok";
  sessionString: string;
  user: Api.User;
}

/** Result type returned by `signIn` when Telegram requires 2FA password. */
export interface TelegramSignInNeedPasswordResult {
  status: "need_password";
  tempSession: string;
}

/** Result type returned by `signInWithPassword` on success (same shape as ok). */
export interface TelegramSignInWithPasswordResult {
  status: "ok";
  sessionString: string;
  user: Api.User;
}

/** Result type returned by `saveSession`, indicating what happened to the account. */
export interface TelegramSaveSessionResult {
  status: "account_created" | "session_replaced";
  accountId: string;
}

/** Result type returned by `logout`. */
export interface TelegramLogoutResult {
  status: "ok";
}

/** Project-wide account info shape for Telegram accounts (DB selection). */
export interface TelegramAccountInfo {
  id: string;
  telegramId: string;
  username: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

/**
 * TelegramService
 *
 * Encapsulates MTProto authentication lifecycle and account/session persistence:
 *  - sendCode: starts auth by sending an SMS/Telegram code
 *  - signIn: completes auth with the received code (or indicates a password is needed)
 *  - signInWithPassword: completes 2FA password step using SRP
 *  - saveSession: persists/rotates encrypted session, ensures 1 active session per account
 *  - logout: logs out from Telegram (best-effort), removes session, marks account inactive
 *  - getAccounts: returns stored Telegram accounts for a given user
 *
 * Notes:
 *  - No business logic was changed; this is a typed/documented refactor.
 *  - Session strings are encrypted at rest and decrypted only when needed.
 */
export class TelegramService {
  /**
   * Creates a TelegramClient instance with an optional preloaded session string.
   * @param sessionString Optional StringSession payload (decrypted plain text).
   */
  initClient(sessionString?: string) {
    return new TelegramClient(
      new StringSession(sessionString ?? ""),
      API_ID,
      API_HASH,
      CLIENT_OPTIONS
    );
  }

  /**
   * Sends an authentication code to the specified phone number via MTProto.
   *
   * @param phoneNumber Full international E.164 phone number (e.g., +380931234567).
   * @returns {TelegramSendCodeResult} phoneCodeHash and a temporary session string.
   *
   * @throws Propagates MTProto/transport errors (e.g., FLOOD_WAIT, PHONE_NUMBER_INVALID).
   */
  async sendCode(phoneNumber: string): Promise<TelegramSendCodeResult> {
    const client = this.initClient();
    await client.connect();

    const res = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );

    return {
      status: "code_sent",
      phoneCodeHash: res.phoneCodeHash,
      tempSession: client.session.save()!,
    };
  }

  /**
   * Completes sign-in with the SMS/Telegram code.
   * If Telegram requires 2FA password, returns `need_password` with a tempSession.
   *
   * @param params.phoneNumber Phone used for the auth flow.
   * @param params.phoneCode The code received by the user.
   * @param params.phoneCodeHash Code hash returned from `sendCode`.
   * @param params.tempSession Temporary session from `sendCode`.
   *
   * @returns {TelegramSignInOkResult | TelegramSignInNeedPasswordResult}
   *
   * @throws Re-throws unexpected MTProto errors (e.g., invalid code, expired hash).
   */
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
    } catch (err: any) {
      const msg = String(err?.message || err).toUpperCase();
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        return { status: "need_password", tempSession: client.session.save()! };
      }
      throw err;
    }
  }

  /**
   * Completes the 2FA password (SRP) step and yields a valid session on success.
   *
   * @param params.password Telegram 2FA password.
   * @param params.tempSession Temporary session string carried from previous step.
   *
   * @returns {TelegramSignInWithPasswordResult} Valid session + user info.
   *
   * @throws Propagates MTProto errors (e.g., bad password).
   */
  async signInWithPassword(params: {
    password: string;
    tempSession: string;
  }): Promise<TelegramSignInWithPasswordResult> {
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
      sessionString: client.session.save()!,
      user: (await client.getMe()) as Api.User,
    };
  }

  /**
   * Encrypts and persists the session, ensuring only one active session per Telegram account.
   * - If the account does not exist → creates it and stores the session.
   * - If it exists → updates profile fields and rotates the session.
   *
   * @param userId Current UniMessenger user id (owner).
   * @param sessionString Plain-text Telegram session string to store.
   * @param telegramUser MTProto user object returned by Telegram.
   *
   * @returns {TelegramSaveSessionResult} Whether a new account was created or session replaced.
   */
  async saveSession(
    userId: string,
    sessionString: string,
    telegramUser: Api.User
  ): Promise<TelegramSaveSessionResult> {
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

  /**
   * Logs out from Telegram (best-effort), deletes stored session and marks account inactive.
   *
   * @param accountId Local DB account id.
   * @returns {TelegramLogoutResult} Operation result.
   */
  async logout(accountId: string): Promise<TelegramLogoutResult> {
    const session = await prisma.telegramSession.findUnique({
      where: { accountId },
    });
    if (!session) return { status: "ok" };

    const client = this.initClient(decryptSession(session.sessionString));
    try {
      await client.connect();
      await client.invoke(new Api.auth.LogOut());
    } catch {
      // Intentionally swallow MTProto errors here: logout is best-effort
    }

    await prisma.telegramSession.delete({ where: { accountId } });
    await prisma.telegramAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return { status: "ok" };
  }

  /**
   * Returns Telegram accounts (DB snapshot) bound to a specific UniMessenger user.
   *
   * @param userId Owner id.
   * @returns {TelegramAccountInfo[]} Array of accounts with basic profile/status fields.
   */
  async getAccounts(userId: string): Promise<TelegramAccountInfo[]> {
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
    return accounts.map((a) => ({
      id: a.id,
      telegramId: a.telegramId,
      username: a.username,
      phoneNumber: a.phoneNumber,
      firstName: a.firstName,
      lastName: a.lastName,
      isActive: a.isActive,
    }));
  }
}
