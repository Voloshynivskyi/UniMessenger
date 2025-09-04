// File: backend/services/telegramAuthService.ts
// Purpose: Service functions for Telegram authentication and session management.
// NOTE: Fixed 2FA flow using `computeCheck` from 'telegram/Password' (SRP).

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { computeCheck } from 'telegram/Password'; // ✅ correct SRP helper
import createDebug from 'debug';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../utils/crypto';
import { sessionManager } from './sessionManager';
import { invalidateDialogsCache } from './dialogsCache'; // ⬅️ for cache invalidation on logout

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
const RESEND_COOLDOWN_MS = 30 * 1000;     // Avoid FLOOD_WAIT

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

/**
 * 1) Send code (idempotent while recent)
 * - Creates a fresh temporary client/session.
 * - Stores phoneCodeHash in memory (pending map) and DB (observability).
 * - Reuses hash during TTL/cooldown to reduce FLOOD_WAITs.
 */
export async function sendCode(phoneNumberRaw: string, sessionId: string): Promise<string> {
  const phoneNumber = normalizePhone(phoneNumberRaw);
  debug('sendCode →', { phoneNumber, sessionId });

  // Ensure session row exists / update phone number for traceability
  const existing = await prisma.session.findUnique({ where: { sessionId } });
  if (!existing) {
    await prisma.session.create({ data: { sessionId, sessionString: '', phoneNumber } });
  } else if (existing.phoneNumber !== phoneNumber) {
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
    // Disconnect temp client; we reconnect the SAME session on authenticate()
    await tempClient.disconnect().catch(() => {});
  }
}

/**
 * 2) Resend — uses SAME temp session + last phoneCodeHash
 */
export async function resendCode(sessionId: string): Promise<string> {
  const p = pending.get(sessionId);
  if (!p) {
    const err = new Error('No pending login found. Start login again.');
    (err as any).status = 400;
    throw err;
  }
  const age = Date.now() - p.sentAt;
  if (age < RESEND_COOLDOWN_MS) {
    const err = new Error('Please wait a few seconds before resending the code.');
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

/**
 * 3) Authenticate with code (+ optional 2FA)
 * - Reuses the SAME temporary session generated by sendCode().
 * - On 2FA required, returns { status: '2FA_REQUIRED' } if no password provided.
 * - When password provided, computes SRP with `computeCheck` and completes sign-in.
 * - Persists encrypted full session and promotes it to long-lived client.
 */
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
    const err = new Error('No active code. Please send the code again.');
    (err as any).status = 400;
    throw err;
  }

  // Build client from the SAME temp session when possible
  const tempClient = await createClientFromSession(stringForAuth);
  try {
    let me: any = null;

    // Step 1: try sign in with code
    try {
      await tempClient.invoke(new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash: hashForAuth,
        phoneCode: code,
      }));
      me = await tempClient.getMe();
    } catch (err: any) {
      const em = String(err?.errorMessage || err?.message || '').toUpperCase();

      // 2FA required → either prompt or complete with password
      if (em.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) {
          return { status: '2FA_REQUIRED' };
        }

        // ✅ Correct SRP flow for GramJS: compute SRP check and pass it to CheckPassword
        try {
          const passwordInfo = await tempClient.invoke(new Api.account.GetPassword());
          const check = await computeCheck(passwordInfo, password);
          await tempClient.invoke(new Api.auth.CheckPassword({ password: check }));
          me = await tempClient.getMe();
        } catch (e: any) {
          const em2 = String(e?.errorMessage || e?.message || '').toUpperCase();
          if (em2.includes('PASSWORD_HASH_INVALID') || em2.includes('SRP_ID_INVALID')) {
            const e2 = new Error('Invalid 2FA password. Please try again.');
            (e2 as any).status = 401;
            throw e2;
          }
          const e2 = new Error(e?.message || '2FA authentication failed');
          (e2 as any).status = 400;
          throw e2;
        }
      } else if (em.includes('PHONE_CODE_EXPIRED')) {
        const e2 = new Error('Code expired. Get a new one and enter the latest code.');
        (e2 as any).status = 400;
        throw e2;
      } else if (em.includes('PHONE_CODE_INVALID')) {
        const e2 = new Error('Invalid code. Check the digits or send the code again.');
        (e2 as any).status = 400;
        throw e2;
      } else if (em.includes('FLOOD_WAIT')) {
        const e2 = new Error('Too many attempts. Please wait a few minutes and try again.');
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

    // Persist full session (encrypted)
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
    // Best-effort disconnect; long-lived client is managed by sessionManager
    await (tempClient as any).disconnect?.().catch(() => {});
  }
}

// -------- P0.1: REAL LOGOUT -------------------------------------------------

function isIgnorableLogoutError(err: any): boolean {
  // comments in English
  // Ignore errors that mean the session is already dead/invalid
  const msg = String(err?.message || err?.errorMessage || '').toUpperCase();
  return (
    msg.includes('AUTH_KEY_UNREGISTERED') ||
    msg.includes('SESSION_REVOKED') ||
    msg.includes('AUTH_KEY_INVALID') ||
    msg.includes('ALREADY_LOGGED_OUT')
  );
}

/**
 * Perform real logout:
 * 1) auth.LogOut() against Telegram (if session is authorized)
 * 2) Always dispose local client
 * 3) Remove session row from DB (idempotent)
 * 4) Invalidate dialogs cache
 */
export async function logout(sessionId: string): Promise<void> {
  const tag = `logout(${sessionId})`;
  debug('%s: start', tag);
  console.log('[authService]', tag, 'start');

  if (!sessionId) {
    const e: any = new Error('Missing sessionId');
    e.status = 400; e.code = 'MISSING_SESSION_ID';
    debug('%s: error - missing sessionId', tag);
    throw e;
  }

  let row: any = null;
  try {
    row = await prisma.session.findUnique({ where: { sessionId } });
    debug('%s: db row %s', tag, row ? 'found' : 'NOT found');
    console.log('[authService]', tag, 'dbRowExists=', !!row);
  } catch (e: any) {
    console.error('[authService]', tag, 'db read error', e);
    throw Object.assign(new Error('DB read failed'), { status: 500, code: 'DB_READ_FAILED' });
  }

  const hasAuthorized = !!row?.sessionString && row.sessionString.length > 0;

  if (hasAuthorized) {
    debug('%s: authorized session detected → auth.LogOut()', tag);
    console.log('[authService]', tag, 'will invoke auth.LogOut()');

    try {
      const client = await sessionManager.ensureClient(sessionId);
      try { await client.connect(); } catch {/* no-op */}
      await client.invoke(new Api.auth.LogOut());
      debug('%s: auth.LogOut OK', tag);
      console.log('[authService]', tag, 'auth.LogOut OK');
    } catch (err: any) {
      console.error('[authService]', tag, 'auth.LogOut error', err?.message || err);
      if (!isIgnorableLogoutError(err)) {
        const e: any = new Error(err?.message || 'Telegram logout failed');
        e.status = 502; e.code = 'TELEGRAM_LOGOUT_FAILED';
        throw e;
      }
      debug('%s: auth.LogOut ignorable error → continue', tag);
    } finally {
      try {
        debug('%s: safeDispose()', tag);
        await sessionManager.safeDispose(sessionId);
        console.log('[authService]', tag, 'safeDispose done');
      } catch (e) {
        console.error('[authService]', tag, 'safeDispose error', e);
      }
    }
  } else {
    debug('%s: no authorized session string → only safeDispose', tag);
    try {
      await sessionManager.safeDispose(sessionId);
      console.log('[authService]', tag, 'safeDispose (no-auth) done');
    } catch (e) {
      console.error('[authService]', tag, 'safeDispose (no-auth) error', e);
    }
  }

  // remove DB row (idempotent)
  try {
    await prisma.session.delete({ where: { sessionId } });
    debug('%s: db row deleted', tag);
    console.log('[authService]', tag, 'db delete done');
  } catch (e: any) {
    if (String(e?.code) === 'P2025') {
      debug('%s: db row already gone', tag);
      console.log('[authService]', tag, 'db row not found on delete (ok)');
    } else {
      console.error('[authService]', tag, 'db delete error', e);
      const err: any = new Error(e?.message || 'DB delete failed');
      err.status = 500; err.code = 'DB_DELETE_SESSION_FAILED';
      throw err;
    }
  }

  invalidateDialogsCache(sessionId);
  debug('%s: cache invalidated', tag);
  console.log('[authService]', tag, 'cache invalidated, done');
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

/**
 * Health util: read stored (encrypted) session string for a given sessionId.
 * Returns the encrypted value stored in DB.
 * If you need to compare fingerprints, do it on the /health endpoint.
 */
export async function getSessionStringFor(sessionId: string): Promise<string | null> {
  const row = await prisma.session.findUnique({ where: { sessionId } });
  return row?.sessionString ?? null;
}
