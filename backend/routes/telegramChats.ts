// backend/routes/telegramChats.ts
// Purpose: Express route for fetching Telegram chat previews (cookie-less friendly).

import { Router, Request, Response } from 'express';
import { TelegramClient } from 'telegram';
import { getClient } from '../services/telegramAuthService';
import { withDialogsCache } from '../services/dialogsCache';

// Use resolver if available (header/query/cookie aware).
// If your project places it at ../utils/sessionResolver, keep this import.
import { resolveSessionId as resolverMaybe } from '../utils/sessionResolver';

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

/** Fallback extractor: header x-session-id -> query (?session|?sessionId|?s) -> cookie sessionId. */
function extractSessionIdFallback(req: Request): string | null {
  const h =
    (req.header('x-session-id') || req.header('X-Session-Id') || '').trim();
  if (h) return h;

  const q =
    (typeof req.query.session === 'string' && req.query.session) ||
    (typeof req.query.sessionId === 'string' && req.query.sessionId) ||
    (typeof req.query.s === 'string' && req.query.s) ||
    '';
  if (q) return String(q).trim();

  const c = (req as any).cookies?.sessionId || '';
  return c ? String(c).trim() : null;
}

function resolveTitle(entity: any): string {
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
  return { id: 'unknown', type: 'chat' };
}

function extractMessageText(msg: any): string {
  if (!msg) return '';
  if ('message' in msg && typeof msg.message === 'string') return msg.message;
  if ('action' in msg) return '[service message]';
  return '';
}

router.get('/telegram/chats', async (req: Request, res: Response) => {
  // ---- Resolve sessionId (resolver -> fallback) ----
  let sessionId: string | null = null;
  try {
    // Prefer shared resolver (it may verify session exists in DB)
    if (typeof (resolverMaybe as any) === 'function') {
      sessionId = await (resolverMaybe as any)(req);
    }
  } catch {
    // ignore; we'll try fallback below
  }
  if (!sessionId) {
    sessionId = extractSessionIdFallback(req);
  }

  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_SESSION_ID',
      message:
        'Provide session id via header "x-session-id" (preferred) or query "?s=/ ?sessionId=/ ?session="',
    });
  }

  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 30;
    console.log(`[telegram/chats] Fetching chats for sessionId=${sessionId}, limit=${limit}`);

    // Will throw if sessionId is unknown/not authorized
    const client: TelegramClient = await getClient(sessionId);

    const dialogs: any[] = await withDialogsCache(sessionId, limit, () =>
      (client as any).getDialogs({ limit })
    );

    const previews: ChatPreview[] = dialogs.map((d: any): ChatPreview => {
      const entity = d.entity;
      const { id, type } = resolvePeer(entity);
      const title = resolveTitle(entity);
      const last = d.message;
      const lastAt =
        last?.date instanceof Date
          ? last.date.toISOString()
          : typeof last?.date === 'number'
          ? new Date(last.date * 1000).toISOString()
          : null;

      return {
        peerId: id,
        title,
        peerType: type,
        lastMessageText: extractMessageText(last),
        lastMessageAt: lastAt,
        unreadCount: typeof d.unreadCount === 'number' ? d.unreadCount : 0,
        isPinned: Boolean(d.pinned),
        photo: null,
      };
    });

    console.log(`[telegram/chats] Returned ${previews.length} chats`);
    return res.json(previews);
  } catch (e: any) {
    const msg = String(e?.message || e || 'Failed to fetch chats');

    // Return 401 when session is missing/invalid/unauthorized, else 500
    if (/not\s*found|no\s*session|invalid\s*session|unauthorized/i.test(msg)) {
      return res.status(401).json({
        ok: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or not authorized',
        details: msg,
      });
    }

    console.error('[telegram/chats] Error:', e);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL',
      message: 'Failed to fetch chats',
      details: msg,
    });
  }
});

export default router;
