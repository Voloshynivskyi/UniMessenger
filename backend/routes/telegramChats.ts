// backend/routes/telegramChats.ts
// Purpose: Express route for fetching Telegram chat previews (cookie-less friendly).
// Notes:
// - Header-first session resolution (x-session-id), with optional cookie fallback.
// - Uses sessionManager.ensureClient for a single source of truth.
// - Uses withDialogsCache(sessionId, limit, fetcher) to reduce load.
// - Returns a plain array of previews to keep FE compatibility.

import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';
import resolveSessionId, { requireSessionId } from '../utils/sessionResolver';
import { withDialogsCache } from '../services/dialogsCache';

function safeErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as any).message);
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}

const router = Router();

type PeerType = 'user' | 'chat' | 'channel';

interface ChatPreview {
  peerId: string;
  title: string;
  peerType: PeerType;
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  photo?: string | null;
}

// ---- helpers ---------------------------------------------------------------

function resolveTitle(entity: any): string {
  // English comment: try "title", fallback to full name, then username, then 'Unknown'
  if (!entity) return 'Unknown';
  if ('title' in entity && entity.title) return String(entity.title);
  const name = [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim();
  return name || String(entity.username || 'Unknown');
}

function resolvePeer(entity: any): { id: string; type: PeerType } {
  const cls = entity?.className;
  if (cls === 'User') return { id: String(entity.id), type: 'user' };
  if (cls === 'Channel') return { id: String(entity.id), type: 'channel' };
  if (cls === 'Chat') return { id: String(entity.id), type: 'chat' };
  // Default to chat for unknown/legacy shapes
  return { id: String(entity?.id ?? 'unknown'), type: 'chat' };
}

function extractMessageText(msg: any): string {
  if (!msg) return '';
  if (typeof msg.message === 'string') return msg.message;
  if (msg.action) return '[service message]';
  // Media placeholders can be added later if needed
  return '';
}

function toIsoDate(msg: any): string | null {
  const d = msg?.date;
  if (!d) return null;
  // Safer than `instanceof` when `d` may be a union type
  if (d && typeof d === 'object' && typeof (d as any).toISOString === 'function') {
    return (d as Date).toISOString();
  }
  if (typeof d === 'number') return new Date(d * 1000).toISOString();
  return null;
}

// ---- route -----------------------------------------------------------------

router.get('/telegram/chats', async (req: Request, res: Response) => {
  try {
    // Header-first; allow cookie fallback for convenience in dev
    const sessionId = await resolveSessionId(req, { allowCookie: true });
    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        error: 'MISSING_SESSION_ID',
        message:
          'Provide session id via header "x-session-id" (preferred) or query (?s|?session|?sessionId).',
      });
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 30;
    console.log(`[telegram/chats] sessionId=${sessionId}, limit=${limit}`);

    // Verify session and get long-lived client
    const sid = await requireSessionId(req, { allowCookie: true });
    const client = await sessionManager.ensureClient(sid);

    // Cache dialogs per (sessionId, limit) for a short TTL to reduce load
    const dialogs: any[] = await withDialogsCache(sid, limit, () =>
      (client as any).getDialogs({ limit })
    );

    const previews: ChatPreview[] = dialogs.map((d: any): ChatPreview => {
      const entity = d.entity;
      const { id, type } = resolvePeer(entity);
      const title = resolveTitle(entity);
      const last = d.message;

      return {
        peerId: id,
        title,
        peerType: type,
        lastMessageText: extractMessageText(last),
        lastMessageAt: toIsoDate(last?.date),
        unreadCount: typeof d.unreadCount === 'number' ? d.unreadCount : 0,
        isPinned: Boolean(d.pinned),
        photo: null,
      };
    });

    // Optional: sort pinned first, then by lastMessageAt desc
    previews.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });

    console.log(`[telegram/chats] Returned ${previews.length} chats`);
    return res.json(previews);
  } catch (e: unknown) {
    // English: narrow unknown safely and map to proper status
    const msg = safeErrorMessage(e);
    const isAuth = /SESSION|AUTH|UNAUTHORIZED|401|not authorized/i.test(msg);
    return res.status(isAuth ? 401 : 400).json({
      ok: false,
      error: 'CHATS_FAILED',
      message: msg,
    });
  }

});

export default router;
