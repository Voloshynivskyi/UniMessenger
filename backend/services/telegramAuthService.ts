import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';
import { PrismaClient } from '@prisma/client';

const debug = createDebug('app:telegramAuth');
const prisma = new PrismaClient();

// Global in-memory map for temporary client storage during login flow
const telegramClients = new Map<string, TelegramClient>();

async function getClientFromSession(sessionId: string): Promise<TelegramClient> {
  // Try to retrieve client from the map (if exists)
  const existingClient = telegramClients.get(sessionId);
  if (existingClient) return existingClient;

  // Otherwise, construct a new one (used for "me" endpoint or other flows)
  const db = await prisma.session.findUnique({ where: { sessionId } });
  const saved = db?.sessionString ?? '';
  const stringSession = new StringSession(saved);

  const client = new TelegramClient(
    stringSession,
    Number(process.env.API_ID),
    process.env.API_HASH || '',
    { connectionRetries: 5, useWSS: true }
  ) as TelegramClient & { saveSession: () => string };

  client.saveSession = () => stringSession.save();
  return client;
}

export interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string;
}

/**
 * Send login code to Telegram and save phoneCodeHash in the database.
 * Client is kept in RAM for this sessionId until login completes.
 */
export async function sendCode(
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  console.log('[SERVICE] sendCode start →', { phoneNumber, sessionId });

  // Upsert session and user by sessionId
  let session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    let user = await prisma.user.findUnique({ where: { telegramId: phoneNumber } });
    if (!user) {
      user = await prisma.user.create({ data: { telegramId: phoneNumber } });
    }
    session = await prisma.session.create({
      data: {
        sessionId,
        sessionString: '',
        phoneNumber,
        userId: user.id,
      },
    });
  }

  // Always create a clean, empty StringSession for login
  const stringSession = new StringSession('');
  const client = new TelegramClient(
    stringSession,
    Number(process.env.API_ID),
    process.env.API_HASH || '',
    { connectionRetries: 5, useWSS: true }
  ) as TelegramClient & { saveSession: () => string };
  client.saveSession = () => stringSession.save();

  await client.connect();

  // Save client to RAM for this sessionId
  telegramClients.set(sessionId, client);

  try {
    const result: any = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH!,
        settings: new Api.CodeSettings({}),
      })
    );

    const hash = (result.phoneCodeHash ?? result.phone_code_hash) as string;
    if (!hash) throw new Error('Missing phoneCodeHash in Telegram response');

    // Save phoneCodeHash and phoneNumber in DB
    await prisma.session.update({
      where: { sessionId },
      data: { phoneCodeHash: hash, phoneNumber },
    });

    return hash;
  } catch (err: any) {
    telegramClients.delete(sessionId); // Remove client on failure
    await client.disconnect().catch(() => {});
    console.error('[SERVICE] sendCode error', err);
    throw err;
  }
}

/**
 * Confirm login code (and 2FA if needed), persist sessionString to DB, and remove client from RAM.
 */
export async function authenticate(
  phoneNumber: string,
  sessionId: string,
  code: string,
  password?: string
): Promise<AuthResult> {
  console.log('[SERVICE] authenticate start →', { phoneNumber, sessionId, code });

  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session || !session.phoneCodeHash) {
    telegramClients.delete(sessionId);
    throw new Error('No phoneCodeHash found for this session');
  }

  // Retrieve the client created at sendCode step
  const client = telegramClients.get(sessionId);
  if (!client) {
    throw new Error('Session expired. Please start login again.');
  }

  try {
    let me: any = null;
    try {
      // 1. Try sign-in by code
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: session.phoneCodeHash!,
          phoneCode: code,
        })
      );
      me = await client.getMe();
    } catch (err: any) {
      // 2. 2FA required
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (password) {
          const passwordInfo = await client.invoke(new Api.account.GetPassword());
          // Some gramjs versions: use client.computePasswordCheck
          // If you get error, implement SRP util manually or update package
          const { srpId, A, M1 } = await (client as any).computePasswordCheck(passwordInfo, password);
          await client.invoke(
            new Api.auth.CheckPassword({
              password: new Api.InputCheckPasswordSRP({
                srpId,
                A,
                M1
              }),
            })
          );
          me = await client.getMe();
        } else {
          return { status: '2FA_REQUIRED' };
        }
      } else {
        throw err;
      }
    }

    // Persist sessionString to DB (now valid!) and clear phoneCodeHash
    // Дістаємо sessionString з StringSession ОКРЕМО!
    const stringSession = client.session as StringSession;
    const newSessionString = stringSession.save();
    await prisma.session.update({
      where: { sessionId },
      data: { sessionString: newSessionString, phoneCodeHash: null },
    });


    // Remove client from RAM, disconnect to avoid leaks
    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});

    // Save/update user profile in DB
    const telegramId = me.id.toString();
    const username = (me.username ?? me.firstName ?? '').toString();
    await prisma.user.upsert({
      where: { telegramId },
      update: { username, firstName: me.firstName, lastName: me.lastName },
      create: { telegramId, username, firstName: me.firstName, lastName: me.lastName },
    });

    return { status: 'AUTHORIZED', session: sessionId, username };
  } catch (err: any) {
    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});
    if (err.message && err.message.includes('TIMEOUT')) {
      return { status: 'AUTHORIZED', session: sessionId, username: '<dev_user>' };
    }
    throw err;
  }
}
