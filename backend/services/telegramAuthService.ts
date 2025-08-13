// backend/services/telegramAuthService.ts
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../utils/crypto';
import { sessionManager } from './sessionManager';

const debug = createDebug('app:telegramAuth');
const prisma = new PrismaClient();

export interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string;
}

// Ensure required env variables exist and are valid
function requireEnv(): { apiId: number; apiHash: string } {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH;
  if (!apiId || !apiHash) throw new Error('Missing API_ID or API_HASH');
  return { apiId, apiHash };
}

// Send a login code to the user's phone and store phoneCodeHash in DB
export async function sendCode(phoneNumber: string, sessionId: string): Promise<string> {
  debug('sendCode →', { phoneNumber, sessionId });

  // Ensure DB row for this sessionId exists (create or update phone)
  const existing = await prisma.session.findUnique({ where: { sessionId } });
  if (!existing) {
    await prisma.session.create({
      data: { sessionId, sessionString: '', phoneNumber },
    });
  } else {
    await prisma.session.update({
      where: { sessionId },
      data: { phoneNumber },
    });
  }

  // Use a temporary client for the login flow only
  const { apiId, apiHash } = requireEnv();
  const tempClient = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });
  await tempClient.connect();

  try {
    // Request Telegram to send a code via SMS/Telegram app
    const result: any = await tempClient.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    // phoneCodeHash is required for the next step (SignIn)
    const hash = result.phoneCodeHash ?? result.phone_code_hash;
    if (!hash) throw new Error('Missing phoneCodeHash in Telegram response');

    await prisma.session.update({
      where: { sessionId },
      data: { phoneCodeHash: hash },
    });

    return hash;
  } finally {
    // Close the temporary client. Long-lived client is created after successful auth.
    await tempClient.disconnect().catch(() => {});
  }
}

// Complete the login using code (+ optional 2FA), persist encrypted session, and start a live client
export async function authenticate(
  phoneNumber: string,
  sessionId: string,
  code: string,
  password?: string
): Promise<AuthResult> {
  debug('authenticate →', { phoneNumber, sessionId });

  // We must have phoneCodeHash saved by sendCode()
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session || !session.phoneCodeHash) {
    throw new Error('No phoneCodeHash found for this session. Start login again.');
  }

  // Use a temporary client for authentication only
  const { apiId, apiHash } = requireEnv();
  const tempClient = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });
  await tempClient.connect();

  try {
    let me: any = null;

    // Try sign-in with code
    try {
      await tempClient.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: session.phoneCodeHash!,
          phoneCode: code,
        })
      );
      me = await tempClient.getMe();
    } catch (err: any) {
      // If 2FA password is enabled on the account
      if (err?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          // Tell the front-end it must ask for 2FA password
          return { status: '2FA_REQUIRED' };
        }

        // SRP flow for 2FA
        const passwordInfo = await tempClient.invoke(new Api.account.GetPassword());
        const { srpId, A, M1 } = await (tempClient as any).computePasswordCheck(passwordInfo, password);
        await tempClient.invoke(
          new Api.auth.CheckPassword({
            password: new Api.InputCheckPasswordSRP({ srpId, A, M1 }),
          })
        );
        me = await tempClient.getMe();
      } else {
        throw err;
      }
    }

    // Upsert local user record
    const telegramId = me.id.toString();
    const username = me.username ?? me.firstName ?? '';
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { username, firstName: me.firstName, lastName: me.lastName },
      create: { telegramId, username, firstName: me.firstName, lastName: me.lastName },
    });

    // Persist encrypted session string for future long-lived client
    const stringSession = tempClient.session as StringSession;
    const encryptedSession = encrypt(stringSession.save());

    await prisma.session.update({
      where: { sessionId },
      data: {
        sessionString: encryptedSession,
        phoneCodeHash: null, // code flow complete
        userId: user.id,
      },
    });

    // 🔴 Critical: start/ensure a long-lived Telegram client managed by SessionManager
    await sessionManager.ensureClient(sessionId);

    return { status: 'AUTHORIZED', session: sessionId, username };
  } finally {
    // Close the temporary login client
    await (tempClient as any).disconnect?.().catch(() => {});
  }
}

// Provide a long-lived client for routes/services (never disconnect it in routes)
export async function getTelegramClientFromDb(sessionId: string): Promise<TelegramClient> {
  return sessionManager.ensureClient(sessionId);
}

// Backward-compat alias (if other modules import getClient)
export const getClient = getTelegramClientFromDb;

// Restore all sessions on server start (best-effort)
export async function restoreAllSessions(): Promise<void> {
  await sessionManager.restoreAll();
}
