// Purpose: Express route for fetching Telegram messages for a chat.

import { Router, Request, Response } from 'express';
import { TelegramClient } from 'telegram';
import { getClient } from '../services/telegramAuthService';
import { resolveSessionId } from '../utils/sessionResolver';

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

function extractDateISO(msg: any): string | null {
  const d = msg?.date;
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'number') return new Date(d * 1000).toISOString();
  return null;
}

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
  if (msg?.action) return true;
  if (typeof msg?.message === 'string') return false;
  return false;
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

function toPeerKeyFromMsg(msg: any): string {
  const p = msg?.peerId || {};
  if (p.userId != null) return `user:${p.userId}`;
  if (p.chatId != null) return `chat:${p.chatId}`;
  if (p.channelId != null) return `channel:${p.channelId}`;
  if (msg?.chatId != null) return `chat:${msg.chatId}`;
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
  const dialogs: any[] = await (client as any).getDialogs({ limit: 200 });
  for (const d of dialogs) {
    const e = d.entity;
    if (toPeerKeyFromEntity(e) === peerKey) return e;
  }
  const [_, idStr] = (peerKey || '').split(':');
  const num = Number(idStr);
  if (Number.isFinite(num)) {
    try { return await (client as any).getEntity(num); } catch {}
  }
  throw new Error('Peer not found: ' + peerKey);
}

// GET /api/telegram/messages?peerKey=...&limit=50&beforeId=12345
router.get('/telegram/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = await resolveSessionId(req);
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;

    let peerKey = String(req.query.peerKey ?? '');
    if (!peerKey) {
      const peerId = String(req.query.peerId ?? '');
      const peerType = String(req.query.peerType ?? '');
      if (peerId && peerType) peerKey = `${peerType}:${peerId}`;
    }
    if (!peerKey) {
      console.warn('[telegram/messages] peerKey missing');
      return res.status(400).json({ error: 'peerKey is required' });
    }

    console.log(`[telegram/messages] Fetching messages for sessionId=${sessionId}, peerKey=${peerKey}, limit=${limit}`);

    const client: TelegramClient = await getClient(sessionId);
    const entity = await resolveEntityByPeerKey(client, peerKey);

    const opts: any = { limit };
    if (beforeId) opts.maxId = beforeId;

    const raw: any[] = [];
    for await (const m of (client as any).iterMessages(entity, opts)) raw.push(m);

    raw.sort((a, b) => (a.id || 0) - (b.id || 0));
    const out: MessageDTO[] = raw.map(toDTO);

    console.log(`[telegram/messages] Returned ${out.length} messages`);
    res.json(out);
  } catch (e: any) {
    console.error('[telegram/messages] Error:', e);
    res.status(400).json({ error: e?.message || 'Failed to fetch messages' });
  }
});

export default router;
