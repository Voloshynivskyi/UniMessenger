// File: frontend/src/api/telegramChats.ts
// Purpose: API client for fetching Telegram chat previews.

import { apiUrl } from '../lib/http';

export type PeerType = 'user' | 'chat' | 'channel';

export interface ChatPreview {
  peerId: string;
  peerType: PeerType;
  title: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  photo: string | null;
}

export async function fetchChatPreviews(sessionId: string, limit = 30): Promise<ChatPreview[]> {
  const params = new URLSearchParams({ sessionId, limit: String(limit) });
  const res = await fetch(apiUrl(`/api/telegram/chats?${params.toString()}`), {
    headers: { 'x-session-id': sessionId },
  });
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!res.ok) {
    try { const json = JSON.parse(text); throw new Error(json?.error || text); }
    catch { throw new Error(text || `HTTP ${res.status}`); }
  }
  if (!ct.includes('application/json')) {
    throw new Error(`Non-JSON response from API:\n${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}
