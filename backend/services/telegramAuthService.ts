// File: backend/services/telegramAuthService.ts
// Service functions for Telegram authentication and session management.

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

// Keep the SAME temporary session between SendCode → SignIn → Resend
type PendingLogin = {
  stringSession: string;   // StringSession.save()
  phoneNumber: string;
  phoneCodeHash: string;
  sentAt: number;
};
const pending = new Map<string, PendingLogin>();

// TTLs / throttling
const CODE_TTL_MS = 5 * 60 * 1000;        // Telegram code validity window
const RESEND_COOLDOWN_MS = 30 * 1000;     // Don't trigger new code too often (avoid FLOOD_WAIT)

function requireEnv(): { apiId: number; apiHash: string } {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH;
  if (!apiId || !apiHash) throw new Error('Missing API_ID or API_HASH');
  return { apiId, apiHash };
}

async function createClientFromSession(stringSession: string) {
  const { apiId, apiHash } = requireEnv();
  const client = new TelegramClient(new StringSession(stringSession), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
  });
  await client.connect();
  return client;
}

// Normalize E.164-ish phone (minimal)
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '');
}

// 1) Send code (idempotent while recent)
export async function sendCode(phoneNumberRaw: string, sessionId: string): Promise<string> {
  const phoneNumber = normalizePhone(phoneNumberRaw);
  debug('sendCode →', { phoneNumber, sessionId });

  // Ensure session row exists
  const existing = await prisma.session.findUnique({ where: { sessionId } });
  if (!existing) {
    await prisma.session.create({ data: { sessionId, sessionString: '', phoneNumber } });
  } else {
    await prisma.session.update({ where: { sessionId }, data: { phoneNumber } });
  }

  // If we already sent a code very recently for this session — return the same hash
  const p = pending.get(sessionId);
  if (p && p.phoneNumber === phoneNumber) {
    const age = Date.now() - p.sentAt;
    if (age < RESEND_COOLDOWN_MS) {
      debug('sendCode: reuse recent hash (cooldown)', { age });
      return p.phoneCodeHash;
    }
    if (age < CODE_TTL_MS) {
      debug('sendCode: reuse current valid hash', { age });
      return p.phoneCodeHash;
    }
    // else TTL expired — fall through to send new code
  }

  // Fresh temp session for login flow
  const tempClient = await createClientFromSession('');
  try {
    const { apiId, apiHash } = requireEnv();
    const result: any = await tempClient.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    const hash = result.phoneCodeHash ?? result.phone_code_hash;
    if (!hash) throw new Error('Missing phoneCodeHash in Telegram response');

    // Save pending (replaces previous)
    const stringSession = (tempClient.session as StringSession).save();
    pending.set(sessionId, { stringSession, phoneNumber, phoneCodeHash: hash, sentAt: Date.now() });

    // Mirror for observability
    await prisma.session.update({ where: { sessionId }, data: { phoneCodeHash: hash } });

    debug('sendCode: hash issued');
    return hash;
  } finally {
    await tempClient.disconnect().catch(() => {});
  }
}

// 2) Resend — uses SAME temp session + last phoneCodeHash
export async function resendCode(sessionId: string): Promise<string> {
  const p = pending.get(sessionId);
  if (!p) {
    const err = new Error('No pending login found. Start login again.');
    (err as any).status = 400;
    throw err;
  }
  const age = Date.now() - p.sentAt;
  if (age < RESEND_COOLDOWN_MS) {
    const err = new Error('Зачекайте кілька секунд перед повторною відправкою коду.');
    (err as any).status = 429;
    throw err;
  }

  const client = await createClientFromSession(p.stringSession);
  try {
    const res: any = await client.invoke(
      new Api.auth.ResendCode({
        phoneNumber: p.phoneNumber,
        phoneCodeHash: p.phoneCodeHash,
      })
    );
    const newHash = res.phoneCodeHash ?? res.phone_code_hash;
    if (!newHash) throw new Error('Missing new phoneCodeHash in ResendCode response');

    pending.set(sessionId, { ...p, phoneCodeHash: newHash, sentAt: Date.now() });
    await prisma.session.update({ where: { sessionId }, data: { phoneCodeHash: newHash } });

    debug('resendCode: new hash issued');
    return newHash;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

// 3) Authenticate with code (+ optional 2FA)
export async function authenticate(
  phoneNumberRaw: string,
  sessionId: string,
  code: string,
  password?: string
): Promise<AuthResult> {
  const phoneNumber = normalizePhone(phoneNumberRaw);
  debug('authenticate →', { phoneNumber, sessionId });

  // Prefer in-memory pending (same temp session)
  const p = pending.get(sessionId);
  let stringForAuth = p?.stringSession ?? '';
  let hashForAuth = p?.phoneCodeHash;

  if (!hashForAuth) {
    const row = await prisma.session.findUnique({ where: { sessionId } });
    hashForAuth = row?.phoneCodeHash || undefined;
  }
  if (!hashForAuth) {
    const err = new Error('Немає активного коду. Надішліть код ще раз.');
    (err as any).status = 400;
    throw err;
  }

  // Build client from the SAME temp session when possible
  const tempClient = await createClientFromSession(stringForAuth);
  try {
    let me: any = null;

    try {
      await tempClient.invoke(new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash: hashForAuth,
        phoneCode: code,
      }));
      me = await tempClient.getMe();
    } catch (err: any) {
      const em = String(err?.errorMessage || err?.message || '').toUpperCase();

      if (em.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) return { status: '2FA_REQUIRED' };
        const passwordInfo = await tempClient.invoke(new Api.account.GetPassword());
        const { srpId, A, M1 } = await (tempClient as any).computePasswordCheck(passwordInfo, password);
        await tempClient.invoke(new Api.auth.CheckPassword({
          password: new Api.InputCheckPasswordSRP({ srpId, A, M1 }),
        }));
        me = await tempClient.getMe();
      } else if (em.includes('PHONE_CODE_EXPIRED')) {
        const e2 = new Error('Код прострочений. Отримайте новий і введіть останній код.');
        (e2 as any).status = 400;
        throw e2;
      } else if (em.includes('PHONE_CODE_INVALID')) {
        const e2 = new Error('Невірний код. Перевірте цифри або надішліть код ще раз.');
        (e2 as any).status = 400;
        throw e2;
      } else if (em.includes('FLOOD_WAIT')) {
        const e2 = new Error('Забагато спроб. Зачекайте кілька хвилин і спробуйте знову.');
        (e2 as any).status = 429;
        throw e2;
      } else {
        const e2 = new Error(err?.message || 'Auth error');
        (e2 as any).status = 400;
        throw e2;
      }
    }

    // Upsert local user
    const telegramId = me.id.toString();
    const username = me.username ?? me.firstName ?? '';
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { username, firstName: me.firstName, lastName: me.lastName },
      create: { telegramId, username, firstName: me.firstName, lastName: me.lastName },
    });

    // Persist full session
    const stringSession = tempClient.session as StringSession;
    const encryptedSession = encrypt(stringSession.save());

    await prisma.session.update({
      where: { sessionId },
      data: { sessionString: encryptedSession, phoneCodeHash: null, userId: user.id },
    });

    // Clear pending (promoted to full session)
    pending.delete(sessionId);

    // Start long-lived client
    await sessionManager.ensureClient(sessionId);

    return { status: 'AUTHORIZED', session: sessionId, username };
  } finally {
    await (tempClient as any).disconnect?.().catch(() => {});
  }
}

// Long-lived client accessor
export async function getTelegramClientFromDb(sessionId: string): Promise<TelegramClient> {
  return sessionManager.ensureClient(sessionId);
}
export const getClient = getTelegramClientFromDb;

// Restore persisted sessions on server start
export async function restoreAllSessions(): Promise<void> {
  await sessionManager.restoreAll();
}
