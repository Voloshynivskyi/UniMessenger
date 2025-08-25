// File: backend/routes/telegramHealth.ts
// Purpose: Lightweight health check for a Telegram sessionId.

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/** GET /api/telegram/health?sessionId=... 
 *  or send 'x-session-id' header.
 *  Returns: { ok: true } if row exists, else 404 with { error }.
 */
router.get('/telegram/health', async (req: Request, res: Response) => {
  try {
    const q = (req.query?.sessionId as string | undefined)?.trim();
    const h = (req.headers?.['x-session-id'] as string | undefined)?.trim();
    const sessionId = q || h;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required (query or x-session-id)' });
    }

    const row = await prisma.session.findUnique({ where: { sessionId } });
    if (!row || !row.sessionString) {
      return res.status(404).json({ error: `Session row not found in DB: ${sessionId}` });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

export default router;
