// File: frontend/src/components/UnifiedInbox.tsx
// Single-account inbox component (kept for compatibility).
// It now works with the new auth context ('status' = 'ready', 'sessionId' can be null).
// If there is no account (authorized=false or sessionId=null) it shows a gentle prompt.
//
// NOTE:
// - We still fetch previews for a single account (first account).
// - WebSocket URL is built via WS_BASE(), consistent with the app.
// - "new_message" payloads can be with `peerKey` (preferred) or legacy `peerId`.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchChatPreviews } from '../api/telegramChats';
import type { ChatPreview, PeerType } from '../api/telegramChats';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { WS_BASE } from '../lib/http';

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

/** Build a WS URL for a given sessionId using app-wide base helper. */
function buildWsUrl(sessionId: string): string {
  return `${WS_BASE()}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

/** Extract {peerType, peerId} from an update payload. Supports peerKey ('user:123') and legacy peerId only. */
function readPeerFromUpdate(data: any): { peerType: PeerType; peerId: string } | null {
  // Preferred new format: peerKey = "user:123" | "chat:456" | "channel:789"
  if (typeof data?.peerKey === 'string' && data.peerKey.includes(':')) {
    const [t, id] = data.peerKey.split(':');
    const peerType = (t as PeerType) || 'chat';
    const peerId = String(id || '');
    if (peerId) return { peerType, peerId };
  }
  // Legacy support: only peerId (we don't know type, fallback to 'chat')
  if (data?.peerId != null) {
    return { peerType: 'chat', peerId: String(data.peerId) };
  }
  return null;
}

/** Apply an incoming "new_message" update to an array of chat previews. */
function applyNewMessage(prevs: ChatPreview[], data: any): ChatPreview[] {
  const peer = readPeerFromUpdate(data);
  const text = typeof data?.text === 'string' ? data.text : '';
  const date = data?.date ?? null;

  if (!peer) return prevs;

  const idx = prevs.findIndex(p => p.peerId === peer.peerId && p.peerType === peer.peerType);
  if (idx === -1) {
    // Chat not present yet → create a minimal shadow preview at the top
    const shadow: ChatPreview = {
      peerId: peer.peerId,
      peerType: peer.peerType,
      title: 'Unknown',
      lastMessageText: text || null,
      lastMessageAt: date,
      unreadCount: 1,
      isPinned: false,
      photo: null,
    };
    return [shadow, ...prevs];
  }

  // Update existing preview and move it to the top
  const updated = { ...prevs[idx] };
  if (text) updated.lastMessageText = text;
  if (date) updated.lastMessageAt = date;
  updated.unreadCount = (updated.unreadCount ?? 0) + 1;

  const next = prevs.slice(0, idx).concat(prevs.slice(idx + 1));
  return [updated, ...next];
}

const UnifiedInbox: React.FC = () => {
  // New context surface: authorized + possibly-null sessionId + status='ready'
  const { authorized, sessionId } = useTelegramAuth();

  // Guard: if no accounts added yet
  if (!authorized || !sessionId) {
    return <div className="p-4 text-gray-600">Додайте акаунт Telegram у розділі Accounts.</div>;
    // UI text in Ukrainian; comments in English.
  }

  // --- From this point, sessionId is a non-null string ---
  const sid = sessionId as string;

  // UI state
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WS refs for lifecycle management
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(0); // exponential reconnect backoff counter

  // 1) Initial fetch once we have a valid session
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    fetchChatPreviews(sid, 30)
      .then(data => {
        if (!cancelled) {
          setChats(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'Не вдалося завантажити');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sid]);

  // 2) WebSocket connect + auto-reconnect
  useEffect(() => {
    function connect() {
      const wsUrl = buildWsUrl(sid);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { backoffRef.current = 0; };

      ws.onmessage = (ev) => {
        try {
          const payload: UpdatePayload = JSON.parse(ev.data);
          if (payload.type === 'new_message') {
            setChats(prev => applyNewMessage(prev, payload.data));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };

      ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, backoffRef.current++), 15000);
        timerRef.current = window.setTimeout(connect, delay);
      };
    }

    connect();

    // Cleanup on unmount or session change
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [sid]);

  // 3) Sort: pinned first, then by lastMessageAt desc
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });
  }, [chats]);

  if (loading && chats.length === 0) {
    return <div className="p-4">Завантаження…</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 space-y-2">
      {sortedChats.map(chat => (
        <div
          key={`${chat.peerType}:${chat.peerId}`}
          className="flex items-start p-3 bg-white rounded-lg shadow hover:bg-gray-50 cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex justify-between">
              <span className="font-semibold">{chat.title}</span>
              <span className="text-sm text-gray-500">
                {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString() : ''}
              </span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {chat.lastMessageText || <span className="italic text-gray-400">Немає повідомлень</span>}
            </div>
          </div>
          {chat.unreadCount > 0 && (
            <div className="ml-2 flex items-center justify-center w-6 h-6 text-white bg-blue-500 rounded-full text-xs">
              {chat.unreadCount}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UnifiedInbox;
