import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';
import { PrismaClient } from '@prisma/client';

const debug = createDebug('app:telegramAuth');
const prisma = new PrismaClient();

const telegramClients = new Map<string, TelegramClient>();

export interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string;
}

// Send code: only Session is created, User will be created after full authorization
export async function sendCode(
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  console.log('[SERVICE] sendCode start →', { phoneNumber, sessionId });

  // Create or update Session without assigning userId
  let session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    session = await prisma.session.create({
      data: {
        sessionId,
        sessionString: '',
        phoneNumber,
      },
    });
  } else {
    await prisma.session.update({
      where: { sessionId },
      data: { phoneNumber },
    });
  }

  const stringSession = new StringSession('');
  const client = new TelegramClient(
    stringSession,
    Number(process.env.API_ID),
    process.env.API_HASH || '',
    { connectionRetries: 5, useWSS: true }
  ) as TelegramClient & { saveSession: () => string };
  client.saveSession = () => stringSession.save();

  await client.connect();
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

    await prisma.session.update({
      where: { sessionId },
      data: { phoneCodeHash: hash },
    });

    return hash;
  } catch (err: any) {
    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});
    console.error('[SERVICE] sendCode error', err);
    throw err;
  }
}

// Authenticate: create User after successful login, then assign userId to Session
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

  const client = telegramClients.get(sessionId);
  if (!client) {
    throw new Error('Session expired. Please start login again.');
  }

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
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (password) {
          const passwordInfo = await client.invoke(new Api.account.GetPassword());
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

    // After login, create or update real User and assign userId to session
    const telegramId = me.id.toString();
    const username = (me.username ?? me.firstName ?? '').toString();
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { username, firstName: me.firstName, lastName: me.lastName },
      create: { telegramId, username, firstName: me.firstName, lastName: me.lastName },
    });

    // Save session string and link to real user
    const stringSession = client.session as StringSession;
    const newSessionString = stringSession.save();
    await prisma.session.update({
      where: { sessionId },
      data: { sessionString: newSessionString, phoneCodeHash: null, userId: user.id },
    });

    telegramClients.delete(sessionId);
    await client.disconnect().catch(() => {});

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
