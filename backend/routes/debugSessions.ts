// backend/routes/debugSessions.ts
// Purpose: Debug endpoints to inspect session rows in DB and force-restore a client.

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sessionManager } from '../services/sessionManager';

const prisma = new PrismaClient();
const router = Router();

/** Mask long secrets in debug output. */
function mask(s: string | null | undefined, keep = 8): string | null {
  if (!s) return null;
  if (s.length <= keep) return '*'.repeat(s.length);
  return s.slice(0, keep) + '…' + '*'.repeat(Math.max(0, s.length - keep - 1));
}

/**
 * GET /debug/sessions
 * Returns a concise list of sessions (no secrets), sorted by createdAt desc.
 */
router.get('/debug/sessions', async (_req: Request, res: Response) => {
  const rows = await prisma.session.findMany({
    select: {
      sessionId: true,
      phoneNumber: true,
      userId: true,
      sessionString: true,
      phoneCodeHash: true,
      createdAt: true,
      // ⚠️ do NOT select updatedAt – your schema doesn't have it
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = rows.map(r => ({
    sessionId: r.sessionId,
    phoneNumber: r.phoneNumber ?? null,
    userId: r.userId ?? null,
    hasSessionString: !!(r.sessionString && r.sessionString.length > 0),
    phoneCodeHash_present: !!r.phoneCodeHash,
    sessionString_len: r.sessionString ? r.sessionString.length : 0,
    createdAt: r.createdAt,
  }));

  res.json({ count: data.length, sessions: data });
});

/**
 * GET /debug/sessions/:sessionId
 * Returns masked details for a single session row.
 */
router.get('/debug/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const r = await prisma.session.findUnique({
    where: { sessionId },
    select: {
      sessionId: true,
      phoneNumber: true,
      userId: true,
      sessionString: true,
      phoneCodeHash: true,
      createdAt: true,
      // ⚠️ no updatedAt here either
    },
  });

  if (!r) return res.status(404).json({ error: 'not found' });

  res.json({
    sessionId: r.sessionId,
    phoneNumber: r.phoneNumber ?? null,
    userId: r.userId ?? null,
    hasSessionString: !!(r.sessionString && r.sessionString.length > 0),
    sessionString_preview: mask(r.sessionString, 8),
    phoneCodeHash_present: !!r.phoneCodeHash,
    createdAt: r.createdAt,
  });
});

/**
 * POST /debug/sessions/restore
 * Body: { sessionId: string }
 * Forces SessionManager.ensureClient(sessionId) and returns status.
 */
router.post('/debug/sessions/restore', async (req: Request, res: Response) => {
  const sessionId = String(req.body?.sessionId || '');
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const client = await sessionManager.ensureClient(sessionId);
    // @ts-ignore gramJS has runtime-only prop
    const connected = !!(client as any).connected;
    res.json({ ok: true, connected });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
