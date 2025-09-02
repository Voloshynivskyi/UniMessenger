// File: frontend/src/api/telegramMessages.ts
// Purpose: API client for fetching and sending Telegram messages.
// Uses shared http wrapper so x-session-id header is always set (header-first).

import http from '../lib/http';

export interface MessageDTO {
  id: number;
  peerKey: string;
  senderId: string | null;
  text: string;
  date: string | null;
  out: boolean;
  service: boolean;
}

export async function fetchMessages(
  sessionId: string,
  peerKey: string,
  limit = 50,
  beforeId?: number
): Promise<MessageDTO[]> {
  // Build query with peerKey (primary) and limit; beforeId as maxId on BE
  const params = new URLSearchParams({ peerKey, limit: String(limit) });
  if (beforeId != null) params.set('beforeId', String(beforeId));

  // http.get will attach x-session-id header for us
  return http.get<MessageDTO[]>(
    `/api/telegram/messages?${params.toString()}`,
    { sessionId }
  );
}

export async function sendMessage(
  sessionId: string,
  peerKey: string,
  text: string,
  replyToId?: number
): Promise<{ ok: boolean; message: MessageDTO }> {
  return http.post<{ ok: boolean; message: MessageDTO }>(
    '/api/telegram/send',
    { peerKey, text, ...(replyToId ? { replyToId } : {}) },
    { sessionId }
  );
}
