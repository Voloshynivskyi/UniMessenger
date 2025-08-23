// src/api/telegramChats.ts
import { apiUrl } from '../lib/http';

export type PeerType = 'user' | 'chat' | 'channel';

export interface ChatPreview {
  peerId: string;
  peerType: PeerType;
  title: string;
  lastMessageText: string | null;
  lastMessageAt: string | null; // ISO
  unreadCount: number;
  isPinned: boolean;
  photo: string | null;
}

export async function fetchChatPreviews(sessionId: string, limit = 30): Promise<ChatPreview[]> {
  const params = new URLSearchParams({ sessionId, limit: String(limit) });
  const res = await fetch(apiUrl(`/api/telegram/chats?${params.toString()}`));

  // Defensive: some setups return HTML (index.html). Guard before json()
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Non-JSON response from API:\n${text.slice(0, 200)}`);
  }
  return res.json();
}
