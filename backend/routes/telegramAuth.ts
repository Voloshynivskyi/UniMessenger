// File: backend/routes/telegramAuth.ts
// Telegram authentication routes (send code, confirm, resend, logout).
// Uses the actual exports from services/telegramAuthService.ts.

import { Router, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { sendCode, resendCode, authenticate, AuthResult } from '../services/telegramAuthService';

const router = Router();
router.use(cookieParser());

type StartBody  = { phoneNumber: string; sessionId: string };
type AuthBody   = { phoneNumber: string; sessionId: string; code: string; password?: string };
type ResendBody = { sessionId: string };

/** Helper: pick sessionId from header or body/query (header preferred). */
function pickSessionId(req: Request): string | null {
  const h = (req.headers['x-session-id'] as string | undefined)?.trim() || null;
  const b = (req.body?.sessionId as string | undefined)?.trim() || null;
  const q = (req.query?.sessionId as string | undefined)?.trim() || null;
  return h || b || q;
}

/** POST /api/telegram/start  — send login code (idempotent while recent) */
router.post('/start', async (req: Request<{}, {}, StartBody>, res: Response) => {
  try {
    const sessionId = pickSessionId(req);
    const phoneNumber = String(req.body?.phoneNumber || '').trim();

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

    await sendCode(phoneNumber, sessionId);
    // We intentionally do NOT set cookies here to avoid cross-account confusion.
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Failed to start auth' });
  }
});

/** POST /api/telegram/resend  — force resend code (respects cooldown/ttl inside service) */
router.post('/resend', async (req: Request<{}, {}, ResendBody>, res: Response) => {
  try {
    const sessionId = pickSessionId(req);
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    await resendCode(sessionId);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Failed to resend code' });
  }
});

/** POST /api/telegram/confirm — confirm with code (+ optional 2FA password) */
router.post('/confirm', async (req: Request<{}, {}, AuthBody>, res: Response) => {
  try {
    const sessionId = pickSessionId(req);
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    const code = String(req.body?.code || '').trim();
    const password = req.body?.password ? String(req.body.password) : undefined;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    if (!phoneNumber || !code) return res.status(400).json({ error: 'phoneNumber and code are required' });

    const result: AuthResult = await authenticate(phoneNumber, sessionId, code, password);
    return res.json(result);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Failed to confirm auth' });
  }
});

/** POST /api/telegram/logout — front-only logout (clear cookie if you used it) */
router.post('/logout', (_req: Request, res: Response) => {
  // We avoid cookies now, but clear it just in case legacy UI set it before.
  res.clearCookie('sessionId');
  return res.json({ ok: true });
});

export default router;
