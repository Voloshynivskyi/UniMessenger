// File: frontend/src/api/telegramChats.ts
// Purpose: API client for fetching Telegram chat previews.
// Notes:
// - Uses shared http wrapper so x-session-id header is always set (header-first).
// - Only "limit" is passed in query; sessionId goes in header.

import http from '../lib/http';

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
  const params = new URLSearchParams({ limit: String(limit) });
  return http.get<ChatPreview[]>(`/api/telegram/chats?${params.toString()}`, {
    sessionId,
  });
}
