// backend/routes/telegramSend.ts
// Purpose: Express route for sending Telegram messages and broadcasting updates.
// Notes:
// - Accepts peer via body.peerKey (primary) or pair peerType+peerId (aliases).
// - Session is resolved header-first; cookie fallback allowed (configurable).
// - Immediately emits WS update and invalidates dialogs cache for fresh previews.

import { Router, Request, Response } from 'express';
import type { TelegramClient } from 'telegram';
import { sessionManager } from '../services/sessionManager';
import resolveSessionId, { requireSessionId } from '../utils/sessionResolver';
import { invalidateDialogsCache } from '../services/dialogsCache';

function safeErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}

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

// ---- helpers ---------------------------------------------------------------

// Extract ISO date from various gramJS shapes
function extractDateISO(msg: any): string | null {
  const d = msg?.date;
  if (!d) return null;
  // Safer than `instanceof` when `d` may be a union type
  if (d && typeof d === 'object' && typeof (d as any).toISOString === 'function') {
    return (d as Date).toISOString();
  }
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
    service: Boolean(msg?.action) || false,
  };
}

async function resolveEntityByPeerKey(client: TelegramClient, peerKey: string): Promise<any> {
  // Try fast-path via dialogs (works for most recent chats)
  const dialogs: any[] = await (client as any).getDialogs({ limit: 200 });
  for (const d of dialogs) {
    const e = d.entity;
    if (toPeerKeyFromEntity(e) === peerKey) return e;
  }
  // Fallback: parse number and getEntity
  const [, idStr] = (peerKey || '').split(':');
  const num = Number(idStr);
  if (Number.isFinite(num)) {
    try { return await (client as any).getEntity(num); } catch {}
  }
  throw new Error('Peer not found: ' + peerKey);
}

// ---- route -----------------------------------------------------------------
// Body: { peerKey?: string, peerId?: string, peerType?: 'user'|'chat'|'channel', text: string, replyToId?: number }
router.post('/telegram/send', async (req: Request, res: Response) => {
  try {
    // Header-first; cookie fallback allowed (opt-in)
    const sessionId = await resolveSessionId(req, { allowCookie: true });

    let { peerKey, peerId, peerType, text, replyToId } = req.body ?? {};
    const message = (typeof text === 'string' ? text : '').trim();

    if (!peerKey && peerId && peerType) peerKey = `${String(peerType)}:${String(peerId)}`;

    if (!peerKey) {
      console.warn('[telegram/send] peerKey missing');
      return res.status(400).json({ ok: false, error: 'MISSING_PEER', message: 'peerKey (or peerId+peerType) is required' });
    }
    if (!message) {
      console.warn('[telegram/send] Message text is empty');
      return res.status(400).json({ ok: false, error: 'EMPTY_MESSAGE', message: 'Message text cannot be empty' });
    }

    const sid = await requireSessionId(req, { allowCookie: true });
    const client = await sessionManager.ensureClient(sid);
    const entity = await resolveEntityByPeerKey(client as any, String(peerKey));

    const sent = await (client as any).sendMessage(entity, {
      message,
      ...(replyToId ? { replyTo: Number(replyToId) } : {}),
    });

    const dto: MessageDTO = toDTO(sent);
    console.log('[telegram/send] Message sent:', dto);

    // Push to WS subscribers immediately
    sessionManager.emit(`update:${String(sid)}`, {
      type: 'new_message',
      data: dto,
    });

    // Invalidate dialogs cache so previews refresh with latest message
    invalidateDialogsCache(String(sid));

    return res.json({ ok: true, message: dto });
  } catch (e: any) {
    console.error('[telegram/send] Error:', e);
    const msg = safeErrorMessage(e);
    const isAuth = /SESSION|AUTH|UNAUTHORIZED|401|not authorized/i.test(msg);
    return res.status(isAuth ? 401 : 400).json({ ok: false, error: 'SEND_FAILED', message: msg });
  }
});

export default router;
