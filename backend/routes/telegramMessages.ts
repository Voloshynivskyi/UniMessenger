// backend/routes/telegramMessages.ts
// Purpose: Express route for fetching Telegram messages for a chat.
// Notes:
// - Accepts peer via ?peerKey= (primary) or ?peer=, or pair ?peerType=&peerId= (aliases).
// - Session is resolved header-first (x-session-id), with cookie fallback allowed.
// - Messages are returned in ascending order by id (oldest -> newest).

import { Router, Request, Response } from 'express';
import type { TelegramClient } from 'telegram';
import { sessionManager } from '../services/sessionManager';
import resolveSessionId, { requireSessionId } from '../utils/sessionResolver';

const router = Router();

interface MessageDTO {
  id: number;
  peerKey: string;             // e.g., "user:123"
  senderId: string | null;
  text: string;
  date: string | null;
  out: boolean;
  service: boolean;
}

// ---- helpers ---------------------------------------------------------------

// Extract ISO date from various gramJS shapes
function extractDateISO(msg: any): string | null {
  const d = msg?.date;
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'number') return new Date(d * 1000).toISOString();
  return null;
}

// Human-friendly text for non-text messages
function textFrom(msg: any): string {
  if (msg?.action) return '[service message]';
  if (typeof msg?.message === 'string' && msg.message.trim().length) return msg.message;
  const m = msg?.media;
  const cls = m?.className || '';
  if (cls.includes('Photo')) return '[photo]';
  if (cls.includes('Document')) return '[document]';
  if (cls.includes('Geo')) return '[location]';
  if (cls.includes('Contact')) return '[contact]';
  if (cls.includes('Dice')) return '[dice]';
  return '';
}

function serviceFlag(msg: any): boolean {
  return Boolean(msg?.action);
}

function toPeerKeyFromMsg(msg: any): string {
  const p = msg?.peerId || {};
  if (p.userId != null) return `user:${p.userId}`;
  if (p.chatId != null) return `chat:${p.chatId}`;
  if (p.channelId != null) return `channel:${p.channelId}`;
  if (msg?.chatId != null) return `chat:${msg.chatId}`;
  return '';
}

function toPeerKeyFromEntity(e: any): string {
  if (e?.className === 'User' && e?.id != null) return `user:${e.id}`;
  if (e?.className === 'Chat' && e?.id != null) return `chat:${e.id}`;
  if (e?.className === 'Channel' && e?.id != null) return `channel:${e.id}`;
  const p = e?.peer;
  if (p?.userId != null) return `user:${p.userId}`;
  if (p?.chatId != null) return `chat:${p.chatId}`;
  if (p?.channelId != null) return `channel:${p.channelId}`;
  return '';
}

function toDTO(msg: any): MessageDTO {
  return {
    id: Number(msg?.id ?? 0),
    peerKey: toPeerKeyFromMsg(msg),
    senderId: (() => {
      const from = msg?.senderId || msg?.fromId;
      const id = from?.userId ?? from?.chatId ?? from?.channelId ?? null;
      return id != null ? String(id) : null;
    })(),
    text: textFrom(msg),
    date: extractDateISO(msg),
    out: Boolean(msg?.out || msg?.isOut),
    service: serviceFlag(msg),
  };
}

async function resolveEntityByPeerKey(client: TelegramClient, peerKey: string): Promise<any> {
  // Try fast-path via dialogs
  const dialogs: any[] = await (client as any).getDialogs({ limit: 200 });
  for (const d of dialogs) {
    const e = d.entity;
    if (toPeerKeyFromEntity(e) === peerKey) return e;
  }
  // Fallback: parse numeric id and resolve entity
  const [, idStr] = (peerKey || '').split(':');
  const num = Number(idStr);
  if (Number.isFinite(num)) {
    try { return await (client as any).getEntity(num); } catch {}
  }
  throw new Error('Peer not found: ' + peerKey);
}

// ---- route -----------------------------------------------------------------
// GET /api/telegram/messages?peerKey=...&limit=50&beforeId=12345
router.get('/telegram/messages', async (req: Request, res: Response) => {
  try {
    // Header-first; cookie fallback allowed for convenience
    const sessionId = await resolveSessionId(req, { allowCookie: true });
    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        error: 'MISSING_SESSION_ID',
        message: 'Provide session id via header "x-session-id" or query (?s|?session|?sessionId).',
      });
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;

    // Accept aliases for backward compatibility
    let peerKey =
      (typeof req.query.peerKey === 'string' && req.query.peerKey) ||
      (typeof req.query.peer === 'string' && req.query.peer) ||
      '';

    if (!peerKey) {
      const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : '';
      const peerType = typeof req.query.peerType === 'string' ? req.query.peerType : '';
      if (peerId && peerType) peerKey = `${peerType}:${peerId}`;
    }

    if (!peerKey) {
      console.warn('[telegram/messages] peerKey missing');
      return res.status(400).json({
        ok: false,
        error: 'MISSING_PEER',
        message: 'Provide ?peerKey= (or alias ?peer=, or pair ?peerType=&peerId=).',
      });
    }

    console.log(`[telegram/messages] sessionId=${sessionId}, peerKey=${peerKey}, limit=${limit}`);

    const sid = await requireSessionId(req, { allowCookie: true });
    const client = await sessionManager.ensureClient(sid);
    const entity = await resolveEntityByPeerKey(client as any, peerKey);

    const opts: any = { limit };
    if (beforeId) opts.maxId = beforeId;

    const raw: any[] = [];
    for await (const m of (client as any).iterMessages(entity, opts)) raw.push(m);

    // Ascending by id (oldest -> newest) for stable UI
    raw.sort((a, b) => (a.id || 0) - (b.id || 0));

    const out: MessageDTO[] = raw.map(toDTO);
    console.log(`[telegram/messages] Returned ${out.length} messages`);

    // Return as plain array to preserve FE compatibility
    res.json(out);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed to fetch messages');
    console.error('[telegram/messages] Error:', e);

    if (/not\s*found|no\s*session|invalid\s*session|unauthorized/i.test(msg)) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or not authorized',
        details: msg,
      });
    }

    return res.status(400).json({ ok: false, error: 'BAD_REQUEST', message: msg });
  }
});

export default router;
