// File: backend/routes/telegramSession.ts
// Purpose: Cookie-less /api/me endpoint with graceful fallback.
// Notes:
// - Primary auth: explicit header "x-session-id" (preferred) or query (?session / ?sessionId)
// - Legacy fallback: cookie "sessionId" (to avoid breaking older frontend until it's updated)
// - Uses sessionManager.ensureClient(sessionId) to verify/restore MTProto client
// - Returns minimal user profile from Telegram "getMe()"
// - Never trusts ambient cookies if header/query provided (header wins)
// - Safe error mapping for 4xx/5xx

import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';

const router = Router();

/** Extract sessionId with explicit-header-first policy. */
function extractSessionId(req: Request): string {
  // 1) Preferred: explicit header
  const headerSid =
    (req.header('x-session-id') || req.header('X-Session-Id') || '').trim();
  if (headerSid) return headerSid;

  // 2) Also allow query (useful for quick curl/tests)
  const q =
    (typeof req.query.session === 'string' && req.query.session) ||
    (typeof req.query.sessionId === 'string' && req.query.sessionId) ||
    '';
  if (q) return String(q).trim();

  // 3) Legacy fallback: cookie (to keep old frontend working)
  const legacy = (req as any).cookies?.sessionId || '';
  return String(legacy || '').trim();
}

router.get('/me', async (req: Request, res: Response) => {
  const sessionId = extractSessionId(req);

  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_SESSION_ID',
      message:
        'Provide session id via header "x-session-id" (preferred) or query "?session=...".',
    });
  }

  try {
    // Ensure/restore MTProto client for this session
    const client = await sessionManager.ensureClient(sessionId);

    // Fetch basic self profile
    // Using "any" to avoid hard coupling to gramJS types here
    const me: any = await client.getMe();

    const user = {
      id: (me?.id ?? '').toString(),
      username: me?.username ?? null,
      firstName: me?.firstName ?? null,
      lastName: me?.lastName ?? null,
      phone: me?.phone ?? null,
      isPremium: !!me?.premium,
    };

    return res.json({
      ok: true,
      provider: 'telegram',
      sessionId,
      user,
      status: 'AUTHORIZED',
    });
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    // Common cases → 401 instead of 500
    if (
      /not\s*found/i.test(msg) ||
      /no\s*session/i.test(msg) ||
      /invalid\s*session/i.test(msg)
    ) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_NOT_FOUND',
        message:
          'Session not found or not authorized. Please login and retry with x-session-id header.',
      });
    }

    // Default 500
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL',
      message: 'Failed to resolve session.',
      details: msg,
    });
  }
});

export default router;
