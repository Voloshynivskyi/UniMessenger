// File: backend/routes/telegramChats.ts
// Express route for fetching Telegram chat previews.

import { Router, Request, Response } from 'express';
import { TelegramClient } from 'telegram';
import { getClient } from '../services/telegramAuthService';
import { resolveSessionId } from '../utils/sessionResolver';

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
  if ('message' in msg && typeof msg.message === 'string' && msg.message.trim().length) return msg.message;
  if ('action' in msg) return '[service message]';
  const m = msg?.media;
  const cls = m?.className || '';
  if (cls.includes('Photo')) return '[photo]';
  if (cls.includes('Document')) return '[document]';
  return '';
}

router.get('/telegram/chats', async (req: Request, res: Response) => {
  try {
    const sessionId = await resolveSessionId(req); // ✅ use robust resolver
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 30;

    console.log(`[telegram/chats] Fetching chats for sessionId=${sessionId}, limit=${limit}`);

    const client: TelegramClient = await getClient(sessionId);
    const dialogs: any[] = await (client as any).getDialogs({ limit });

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

    // Pinned first, then by last message time desc
    previews.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });

    console.log(`[telegram/chats] Returned ${previews.length} chats`);
    return res.json(previews);
  } catch (e: any) {
    const msg = e?.message || 'Failed to fetch chats';
    console.error('[telegram/chats] Error:', e);
    return res.status(400).json({ error: msg });
  }
});

export default router;
