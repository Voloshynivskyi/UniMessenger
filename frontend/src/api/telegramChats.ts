const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7007';

export interface ChatPreview {
  peerId: string;
  title: string;
  peerType: 'user' | 'chat' | 'channel';
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  photo?: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(data?.error || `API error: ${res.status}`);
  return (data ?? null) as T;
}

export async function fetchChatPreviews(sessionId: string, limit = 30): Promise<ChatPreview[]> {
  const url = new URL(`${BASE_URL}/api/telegram/chats`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { method: 'GET', credentials: 'include' });
  return handleResponse<ChatPreview[]>(res);
}
