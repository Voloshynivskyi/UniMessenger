// src/api/telegramMessages.ts
import { apiUrl } from '../lib/http';

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
  const params = new URLSearchParams({ sessionId, peerKey, limit: String(limit) });
  if (beforeId) params.set('beforeId', String(beforeId));

  const res = await fetch(apiUrl(`/api/telegram/messages?${params.toString()}`));
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
