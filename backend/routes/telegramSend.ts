// backend/routes/telegramSend.ts
import { Router, Request, Response } from 'express';
import { TelegramClient } from 'telegram';
import { getClient } from '../services/telegramAuthService';
import { sessionManager } from '../services/sessionManager'; // 👈 for immediate WS broadcast

const router = Router();

interface MessageDTO {
  id: number;
  peerKey: string;             // "user:123" | "chat:456" | "channel:789"
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
    service: Boolean(msg?.action) || false,
  };
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

async function resolveEntityByPeerKey(client: TelegramClient, peerKey: string): Promise<any> {
  // Prefer dialogs scan (stable), then fallback to getEntity(number)
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

// Body: { sessionId: string, peerKey: string, text: string, replyToId?: number }
router.post('/telegram/send', async (req: Request, res: Response) => {
  try {
    const { sessionId, peerKey, text, replyToId } = req.body ?? {};
    const message = (typeof text === 'string' ? text : '').trim();

    if (!sessionId || !peerKey) {
      return res.status(400).json({ error: 'sessionId and peerKey are required' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    const client: TelegramClient = await getClient(String(sessionId));
    const entity = await resolveEntityByPeerKey(client, String(peerKey));

    const sent = await (client as any).sendMessage(entity, {
      message,
      ...(replyToId ? { replyTo: Number(replyToId) } : {}),
    });

    const dto: MessageDTO = toDTO(sent);

    // 👇 Proactively broadcast over WS so the UI updates instantly
    sessionManager.emit(`update:${String(sessionId)}`, {
      type: 'new_message',
      data: dto,
    });

    return res.json({ ok: true, message: dto });
  } catch (e: any) {
    console.error('[ROUTE] /telegram/send error:', e);
    return res.status(500).json({ error: e?.message || 'Failed to send message' });
  }
});

export default router;
