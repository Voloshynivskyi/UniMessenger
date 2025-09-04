// File: backend/routes/telegramAuth.ts
// Telegram authentication routes (send code, confirm, resend, logout).
// Uses unified session resolver (header-first) and consistent error payloads.

import { Router, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { sendCode, resendCode, authenticate, AuthResult, logout as tgLogout } from '../services/telegramAuthService';
import resolveSessionId from '../utils/sessionResolver';

const router = Router();
router.use(cookieParser());

type StartBody  = { phoneNumber: string; sessionId?: string };
type AuthBody   = { phoneNumber: string; code: string; sessionId?: string; password?: string };
type ResendBody = { sessionId?: string };

// ---- helpers ---------------------------------------------------------------

/** Send a typed error with unified shape. */
function sendErr(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: code, message });
}

/** Resolve sessionId with header-first policy; do not require it to exist in DB yet. */
async function pickSessionIdHeaderFirst(req: Request): Promise<string | null> {
  // For auth start/resend/confirm we cannot require session presence in DB,
  // because the session may not be created yet. We only resolve its value.
  return resolveSessionId(req, { allowCookie: true, requireInDb: false });
}

// ---- routes ----------------------------------------------------------------

/** POST /api/telegram/start  — send login code (idempotent while recent) */
router.post('/start', async (req: Request<{}, {}, StartBody>, res: Response) => {
  try {
    const sessionId = await pickSessionIdHeaderFirst(req);
    const phoneNumber = String(req.body?.phoneNumber || '').trim();

    if (!sessionId) return sendErr(res, 'MISSING_SESSION_ID',
      'Provide session id via header "x-session-id" or query (?s|?session|?sessionId).');

    if (!phoneNumber) return sendErr(res, 'MISSING_PHONE_NUMBER', 'phoneNumber is required');

    await sendCode(phoneNumber, sessionId);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || 'Failed to start auth');
    if (/FLOOD|FLOOD_WAIT/i.test(msg)) return sendErr(res, 'FLOOD_WAIT', msg, 429);
    if (/PHONE_MIGRATED/i.test(msg))   return sendErr(res, 'PHONE_MIGRATED', msg, 400);
    return sendErr(res, 'BAD_REQUEST', msg, 400);
  }
});

/** POST /api/telegram/resend  — force resend code (respects cooldown/ttl inside service) */
router.post('/resend', async (req: Request<{}, {}, ResendBody>, res: Response) => {
  try {
    const sessionId = await pickSessionIdHeaderFirst(req);
    if (!sessionId) return sendErr(res, 'MISSING_SESSION_ID',
      'Provide session id via header "x-session-id" or query (?s|?session|?sessionId).');

    await resendCode(sessionId);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || 'Failed to resend code');
    if (/FLOOD|FLOOD_WAIT/i.test(msg)) return sendErr(res, 'FLOOD_WAIT', msg, 429);
    if (/NO_PENDING/i.test(msg))       return sendErr(res, 'NO_PENDING_CODE', msg, 400);
    return sendErr(res, 'BAD_REQUEST', msg, 400);
  }
});

/** POST /api/telegram/confirm — confirm with code (+ optional 2FA password) */
router.post('/confirm', async (req: Request<{}, {}, AuthBody>, res: Response) => {
  try {
    const sessionId = await pickSessionIdHeaderFirst(req);
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    const code = String(req.body?.code || '').trim();
    const password = req.body?.password ? String(req.body.password) : undefined;

    if (!sessionId) return sendErr(res, 'MISSING_SESSION_ID',
      'Provide session id via header "x-session-id" or query (?s|?session|?sessionId).');

    if (!phoneNumber || !code) {
      return sendErr(res, 'MISSING_FIELDS', 'phoneNumber and code are required');
    }

    const result: AuthResult = await authenticate(phoneNumber, sessionId, code, password);
    return res.json(result);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed to confirm auth');
    if (/2FA|PASSWORD/i.test(msg))     return sendErr(res, '2FA_REQUIRED', msg, 401);
    if (/FLOOD|FLOOD_WAIT/i.test(msg)) return sendErr(res, 'FLOOD_WAIT', msg, 429);
    if (/CODE_INVALID/i.test(msg))     return sendErr(res, 'CODE_INVALID', msg, 400);
    if (/CODE_EXPIRED/i.test(msg))     return sendErr(res, 'CODE_EXPIRED', msg, 400);
    return sendErr(res, 'BAD_REQUEST', msg, 400);
  }
});

/**
 * POST /api/telegram/logout — REAL logout:
 * - auth.LogOut() at Telegram if authorized
 * - dispose local client
 * - delete DB row
 * - invalidate caches
 */
router.post('/logout', async (req: Request, res: Response) => {
  const rid = `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  console.log('[route/logout]', rid, 'headers.x-session-id=', req.headers['x-session-id'], 'query=', req.query);

  try {
    const sessionId = await resolveSessionId(req, { allowCookie: true, requireInDb: false });
    console.log('[route/logout]', rid, 'resolved sessionId=', sessionId);

    if (!sessionId) {
      console.warn('[route/logout]', rid, 'NO sessionId resolved');
      return sendErr(res, 'MISSING_SESSION_ID',
        'Provide session id via header "x-session-id" or query (?s|?session|?sessionId).');
    }

    await tgLogout(sessionId);

    // Clear legacy cookie just in case older UI used it
    res.clearCookie('sessionId');
    console.log('[route/logout]', rid, 'OK');
    return res.json({ ok: true });
  } catch (err: any) {
    const status = err?.status ?? 500;
    const code = err?.code ?? 'LOGOUT_FAILED';
    const message = String(err?.message || 'Logout failed');
    console.error('[route/logout]', rid, 'ERROR', status, code, message);
    return res.status(status).json({ ok: false, error: code, message });
  }
});

export default router;
