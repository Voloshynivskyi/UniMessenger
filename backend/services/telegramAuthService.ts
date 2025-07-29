// backend/services/telegramAuthService.ts
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import createDebug from 'debug';

const debug = createDebug('app:telegramAuth');
const sessions = new Map<string, string>();

function getClient(
  sessionId: string
): TelegramClient & { saveSession: () => string } {
  const saved = sessions.get(sessionId) || '';
  const stringSession = new StringSession(saved);

  const client = new TelegramClient(
    stringSession,
    Number(process.env.API_ID),
    process.env.API_HASH ?? '',
    { connectionRetries: 5, useWSS: true, testServers: false }
  ) as TelegramClient & { saveSession: () => string };

  client.saveSession = (): string => {
    const newSession = stringSession.save();
    sessions.set(sessionId, newSession);
    return newSession;
  };

  return client;
}

export interface AuthResult {
  status: 'AUTHORIZED' | '2FA_REQUIRED';
  session?: string;
  username?: string;      // додаємо тут
}

export async function sendCode(
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  if (!process.env.API_ID || !process.env.API_HASH) {
    throw new Error('API_ID or API_HASH not set in .env');
  }
  const client = getClient(sessionId);
  try {
    await client.connect();
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH,
        settings: new Api.CodeSettings({}),
      })
    );
    const phoneCodeHash = (result as any).phone_code_hash as string;
    client.saveSession();
    return phoneCodeHash;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function authenticate(
  phoneNumber: string,
  code: string,
  password: string | undefined,
  sessionId: string
): Promise<AuthResult> {
  const client = getClient(sessionId);
  try {
    await client.connect();
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => code,
      password: password ? async () => password : undefined,
      onError: err => debug('authenticate error', err),
    });

    // Момент авторизації пройшов — зберігаємо сесію
    const newSession = client.saveSession();

    // Додатково отримуємо інформацію про себе
    const me = await client.getMe();
    // username може бути undefined, тоді беремо firstName
    const username = (me.username ?? me.firstName ?? '').toString();

    return { status: 'AUTHORIZED', session: newSession, username };
  } catch (err: any) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { status: '2FA_REQUIRED' };
    }
    debug('authenticate error', err);
    throw err;
  } finally {
    await client.disconnect().catch(() => {});
  }
}
