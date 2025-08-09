import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../utils/crypto';

const debug = createDebug('app:telegramAuth');
const prisma = new PrismaClient();

const telegramClients = new Map<string, TelegramClient>();

export interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string;
}

function requireEnv(): { apiId: number; apiHash: string } {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH;
  if (!apiId || !apiHash) throw new Error('Missing API_ID or API_HASH');
  return { apiId, apiHash };
}

// Send login code and create/update Session
export async function sendCode(
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  debug('sendCode →', { phoneNumber, sessionId });

  let session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    session = await prisma.session.create({
      data: { sessionId, sessionString: '', phoneNumber },
    });
  } else {
    await prisma.session.update({
      where: { sessionId },
      data: { phoneNumber },
    });
  }

  const { apiId, apiHash } = requireEnv();
  const stringSession = new StringSession('');
  const client = new TelegramClient(
    stringSession,
    apiId,
    apiHash,
    { connectionRetries: 5, useWSS: true }
  );

  telegramClients.set(sessionId, client);
  await client.connect();

  try {
    const result: any = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    const hash = result.phoneCodeHash ?? result.phone_code_hash;
    if (!hash) throw new Error('Missing phoneCodeHash in Telegram response');

    await prisma.session.update({
      where: { sessionId },
      data: { phoneCodeHash: hash },
    });

    return hash;
  } catch (err) {
    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});
    throw err;
  }
}

// Authenticate with code (+ optional 2FA)
export async function authenticate(
  phoneNumber: string,
  sessionId: string,
  code: string,
  password?: string
): Promise<AuthResult> {
  debug('authenticate →', { phoneNumber, sessionId });

  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session || !session.phoneCodeHash) {
    telegramClients.delete(sessionId);
    throw new Error('No phoneCodeHash found for this session');
  }

  const client = telegramClients.get(sessionId);
  if (!client) throw new Error('Session expired. Please start login again.');

  try {
    let me: any = null;

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: session.phoneCodeHash!,
          phoneCode: code,
        })
      );
      me = await client.getMe();
    } catch (err: any) {
      if (err?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) return { status: '2FA_REQUIRED' };

        const passwordInfo = await client.invoke(new Api.account.GetPassword());
        const { srpId, A, M1 } = await (client as any).computePasswordCheck(passwordInfo, password);
        await client.invoke(
          new Api.auth.CheckPassword({
            password: new Api.InputCheckPasswordSRP({ srpId, A, M1 }),
          })
        );
        me = await client.getMe();
      } else {
        throw err;
      }
    }

    const telegramId = me.id.toString();
    const username = me.username ?? me.firstName ?? '';
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { username, firstName: me.firstName, lastName: me.lastName },
      create: { telegramId, username, firstName: me.firstName, lastName: me.lastName },
    });

    // Save encrypted session
    const stringSession = client.session as StringSession;
    const encryptedSession = encrypt(stringSession.save());

    await prisma.session.update({
      where: { sessionId },
      data: {
        sessionString: encryptedSession,
        phoneCodeHash: null,
        userId: user.id,
      },
    });

    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});

    return { status: 'AUTHORIZED', session: sessionId, username };
  } catch (err) {
    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});
    throw err;
  }
}

// Get a ready-to-use Telegram client by sessionId from DB
export async function getTelegramClientFromDb(sessionId: string): Promise<TelegramClient> {
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session || !session.sessionString) {
    throw new Error('Session not found or not authorized');
  }

  const { apiId, apiHash } = requireEnv();
  const decrypted = decrypt(session.sessionString);
  const client = new TelegramClient(
    new StringSession(decrypted),
    apiId,
    apiHash,
    { connectionRetries: 5, useWSS: true }
  );
  await client.connect();
  return client;
}

// Backward-compat alias
export const getClient = getTelegramClientFromDb;

// Restore sessions on server start (non-fatal on failure)
export async function restoreAllSessions(): Promise<void> {
  debug('restoreAllSessions → start');
  const sessions = await prisma.session.findMany({
    // field is non-nullable String → filter out empty strings instead of `not: null`
    where: { sessionString: { not: '' } },
    select: { sessionId: true, sessionString: true },
  });

  const { apiId, apiHash } = requireEnv();

  for (const s of sessions) {
    try {
      const decrypted = decrypt(s.sessionString);
      const client = new TelegramClient(
        new StringSession(decrypted),
        apiId,
        apiHash,
        { connectionRetries: 3, useWSS: true }
      );
      await client.connect();
      telegramClients.set(s.sessionId, client);
      debug(`restoreAllSessions → restored ${s.sessionId}`);
    } catch (err) {
      debug(`restoreAllSessions → failed for ${s.sessionId}:`, err);
      // не падаємо, йдемо далі
    }
  }

  debug('restoreAllSessions → done');
}
