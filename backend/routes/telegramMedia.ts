// File: backend/routes/telegramMedia.ts
// Purpose: Send media (photo/video/document/URL) via Telegram MTProto using gramJS.
// Inputs (JSON body):
//   - peerKey?: string  (preferred, e.g., "user:123", "chat:456", "channel:789")
//   - peerType?: 'user'|'chat'|'channel' + peerId?: string|number (alias if no peerKey)
//   - url?: string      (HTTP/HTTPS direct URL to the file)
//   - caption?: string
//   - forceDocument?: boolean  (send as file even if it's an image/video URL)
//   - replyToId?: number
//
// Notes:
// - This step supports URL only (no multipart upload). We'll add multipart later.
// - Emits WS update and invalidates dialogs cache for fresh previews.

import { Router, Request, Response } from 'express';
import type { TelegramClient } from 'telegram';
import resolveSessionId, { requireSessionId } from '../utils/sessionResolver';
import { sessionManager } from '../services/sessionManager';
import { invalidateDialogsCache } from '../services/dialogsCache';
import multer from 'multer';
import { CustomFile } from 'telegram/client/uploads'; // for Buffer uploads

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (raise later if needed)
  },
});

const router = Router();

interface MessageDTO {
  id: number;
  peerKey: string;
  senderId: string | null;
  text: string;
  date: string | null;
  out: boolean;
  service: boolean;
}

// -------------------- helpers --------------------

function safeErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}

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

// Prefer human text/caption; show short placeholders for media types
function textFrom(msg: any): string {
  if (msg?.action) return '[service message]';
  // For media messages, gramJS usually places caption into msg.message
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
  // Try fast-path via dialogs
  const dialogs: any[] = await (client as any).getDialogs({ limit: 200 });
  for (const d of dialogs) {
    const e = d.entity;
    if (toPeerKeyFromEntity(e) === peerKey) return e;
  }
  // Fallback: parse numeric id and getEntity
  const [, idStr] = (peerKey || '').split(':');
  const num = Number(idStr);
  if (Number.isFinite(num)) {
    try { return await (client as any).getEntity(num); } catch {}
  }
  throw new Error('Peer not found: ' + peerKey);
}

// -------------------- route --------------------

// Body: { peerKey?: string, peerType?: 'user'|'chat'|'channel', peerId?: string|number,
//         url?: string, caption?: string, forceDocument?: boolean, replyToId?: number }
router.post('/telegram/sendMedia', async (req: Request, res: Response) => {
  try {
    // Header-first; cookie fallback allowed (opt-in)
    const sessionId = await resolveSessionId(req, { allowCookie: true });

    let { peerKey, peerType, peerId, url, caption, forceDocument, replyToId } = req.body ?? {};
    if (!peerKey && peerType && peerId != null) {
      peerKey = `${String(peerType)}:${String(peerId)}`;
    }

    const fileUrl = typeof url === 'string' ? url.trim() : '';
    const cap = typeof caption === 'string' ? caption : '';

    if (!peerKey) {
      return res.status(400).json({ ok: false, error: 'MISSING_PEER', message: 'peerKey (or peerType+peerId) is required' });
    }
    if (!fileUrl) {
      return res.status(400).json({ ok: false, error: 'MISSING_URL', message: 'url is required for this endpoint' });
    }

    const sid = await requireSessionId(req, { allowCookie: true });
    const client = await sessionManager.ensureClient(sid);
    const entity = await resolveEntityByPeerKey(client as any, String(peerKey));

    // gramJS helper: sendFile(chat, { file, caption, forceDocument, replyTo })
    const sent = await (client as any).sendFile(entity, {
      file: fileUrl,
      caption: cap,
      ...(forceDocument ? { forceDocument: true } : {}),
      ...(replyToId ? { replyTo: Number(replyToId) } : {}),
    });

    const dto = toDTO(sent);
    console.log('[telegram/sendMedia] Media sent:', dto);

    // Emit WS update and drop dialogs cache for fresh previews
    sessionManager.emit(`update:${String(sid)}`, { type: 'new_message', data: dto });
    invalidateDialogsCache(String(sid));

    return res.json({ ok: true, message: dto });
  } catch (e: unknown) {
    console.error('[telegram/sendMedia] Error:', e);
    const msg = safeErrorMessage(e);
    const isAuth = /SESSION|AUTH|UNAUTHORIZED|401|not authorized/i.test(msg);
    return res.status(isAuth ? 401 : 400).json({ ok: false, error: 'SEND_MEDIA_FAILED', message: msg });
  }
});
// POST /api/telegram/sendMedia/file
// Content-Type: multipart/form-data
// Fields:
//   - file: <binary> (required)
//   - peerKey?: string  OR pair: peerType + peerId
//   - caption?: string
//   - forceDocument?: 'true'|'false'
//   - replyToId?: number
router.post('/telegram/sendMedia/file', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Header-first; cookie fallback allowed (opt-in)
    await resolveSessionId(req, { allowCookie: true }); // soft check for logging
    const sid = await requireSessionId(req, { allowCookie: true });

    const body = req.body ?? {};
    let { peerKey, peerType, peerId, caption, forceDocument, replyToId } = body;

    if (!peerKey && peerType && peerId != null) {
      peerKey = `${String(peerType)}:${String(peerId)}`;
    }
    if (!peerKey) {
      return res.status(400).json({ ok: false, error: 'MISSING_PEER', message: 'peerKey (or peerType+peerId) is required' });
    }

    const file = req.file;
    if (!file || !file.buffer || !file.size) {
      return res.status(400).json({ ok: false, error: 'MISSING_FILE', message: 'multipart field "file" is required' });
    }

    const cap = typeof caption === 'string' ? caption : '';
    const asDoc = String(forceDocument).toLowerCase() === 'true';
    const replyTo = replyToId != null ? Number(replyToId) : undefined;

    const client = await sessionManager.ensureClient(sid);
    const entity = await (async () => {
      // Reuse same resolver as URL route
      const dialogs: any[] = await (client as any).getDialogs({ limit: 200 });
      for (const d of dialogs) {
        const e = d.entity;
        const p = e?.peer;
        const key =
          (e?.className === 'User'    && e?.id != null) ? `user:${e.id}` :
          (e?.className === 'Chat'    && e?.id != null) ? `chat:${e.id}` :
          (e?.className === 'Channel' && e?.id != null) ? `channel:${e.id}` :
          (p?.userId != null)    ? `user:${p.userId}` :
          (p?.chatId != null)    ? `chat:${p.chatId}` :
          (p?.channelId != null) ? `channel:${p.channelId}` : '';
        if (key === String(peerKey)) return e;
      }
      const [, idStr] = String(peerKey).split(':');
      const num = Number(idStr);
      if (Number.isFinite(num)) {
        try { return await (client as any).getEntity(num); } catch {}
      }
      throw new Error('Peer not found: ' + peerKey);
    })();

    // Build CustomFile from Buffer
    const safeName =
      (file.originalname || 'upload.bin')
        .replace(/[^\x20-\x7E]/g, '_') // ascii-only
        .slice(0, 128);                 // clamp name length

    const cf = new CustomFile(safeName, file.size, '', file.buffer);

    // Send via gramJS
    const sent = await (client as any).sendFile(entity, {
      file: cf,
      caption: cap,
      ...(asDoc ? { forceDocument: true } : {}),
      ...(replyTo != null ? { replyTo } : {}),
    });

    // Reuse DTO helpers from this file
    const dto = {
      id: Number(sent?.id ?? 0),
      peerKey: (() => {
        const p = sent?.peerId || {};
        if (p.userId != null) return `user:${p.userId}`;
        if (p.chatId != null) return `chat:${p.chatId}`;
        if (p.channelId != null) return `channel:${p.channelId}`;
        if (sent?.chatId != null) return `chat:${sent.chatId}`;
        return '';
      })(),
      senderId: (() => {
        const from = sent?.senderId || sent?.fromId;
        const id = from?.userId ?? from?.chatId ?? from?.channelId ?? null;
        return id != null ? String(id) : null;
      })(),
      text: (() => {
        if (sent?.action) return '[service message]';
        if (typeof sent?.message === 'string' && sent.message.trim().length) return sent.message;
        const m = sent?.media;
        const cls = m?.className || '';
        if (cls.includes('Photo')) return '[photo]';
        if (cls.includes('Document')) return '[document]';
        if (cls.includes('Geo')) return '[location]';
        if (cls.includes('Contact')) return '[contact]';
        if (cls.includes('Dice')) return '[dice]';
        return '';
      })(),
      date: (() => {
        const d = sent?.date;
        if (!d) return null;
        if (d && typeof d === 'object' && typeof (d as any).toISOString === 'function') {
          return (d as Date).toISOString();
        }
        if (typeof d === 'number') return new Date(d * 1000).toISOString();
        return null;
      })(),
      out: Boolean(sent?.out || sent?.isOut),
      service: Boolean(sent?.action) || false,
    } as MessageDTO;

    // Emit WS update & invalidate dialogs cache
    sessionManager.emit(`update:${String(sid)}`, { type: 'new_message', data: dto });
    invalidateDialogsCache(String(sid));

    return res.json({ ok: true, message: dto });
  } catch (e: unknown) {
    const msg = safeErrorMessage(e);
    const isAuth = /SESSION|AUTH|UNAUTHORIZED|401|not authorized/i.test(msg);
    return res.status(isAuth ? 401 : 400).json({ ok: false, error: 'SEND_MEDIA_FILE_FAILED', message: msg });
  }
});

export default router;
