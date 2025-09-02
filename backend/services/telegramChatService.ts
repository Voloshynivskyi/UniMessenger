// backend/services/telegramChatService.ts
// Purpose: Service functions for fetching Telegram chat previews.
// Notes:
// - This module no longer manages TelegramClient directly.
// - It relies on sessionManager.ensureClient for a single source of truth.
// - Keep this service thin: mapping only. Heavy lifting stays in the route.

import { sessionManager } from './sessionManager';

type PeerType = 'user' | 'chat' | 'channel';

export interface ChatPreview {
  peerId: string;
  title: string;
  peerType: PeerType;
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  photo?: string | null;
}

// ---- helpers (duplicated minimal set to keep service self-contained) -------

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
  return { id: String(entity?.id ?? 'unknown'), type: 'chat' };
}

function extractMessageText(msg: any): string {
  if (!msg) return '';
  if (typeof msg.message === 'string') return msg.message;
  if (msg.action) return '[service message]';
  return '';
}

function toIsoDate(d: any): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'number') return new Date(d * 1000).toISOString();
  return null;
}

// ---- API -------------------------------------------------------------------

/** Get list of chats with last message preview (no caching here) */
export async function getChatPreviews(sessionId: string, limit = 30): Promise<ChatPreview[]> {
  // English comment: ensure a single long-lived client instance per sessionId
  const client = await sessionManager.ensureClient(sessionId);
  const dialogs: any[] = await (client as any).getDialogs({ limit });

  const items: ChatPreview[] = dialogs.map((d: any) => {
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

  // Optional: pinned first, then by lastMessageAt desc
  items.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return tb - ta;
  });

  return items;
}
