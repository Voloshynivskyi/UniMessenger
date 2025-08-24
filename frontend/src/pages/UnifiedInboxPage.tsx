// File: frontend/src/pages/UnifiedInboxPage.tsx
// Unified inbox page, displays chat previews and handles live updates.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchChatPreviews, type ChatPreview } from '../api/telegramChats';
import { WS_BASE } from '../lib/http';

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

// Build WS url against same-origin (Vite proxy or env)
function buildWsUrl(sessionId: string): string {
  return `${WS_BASE()}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

// Apply "new message" preview to the chats list (move updated chat to top)
function applyNewMessage(prevs: ChatPreview[], data: any): ChatPreview[] {
  const peerKey = String(data?.peerKey || '');
  const text = typeof data?.text === 'string' ? data.text : '';
  const date = data?.date ?? null;
  if (!peerKey) return prevs;

  const [peerType, peerId] = peerKey.split(':');
  const i = prevs.findIndex(p => p.peerType === (peerType as any) && p.peerId === peerId);
  if (i === -1) {
    const shadow: ChatPreview = {
      peerId,
      peerType: peerType as any,
      title: 'Unknown',
      lastMessageText: text,
      lastMessageAt: date,
      unreadCount: 1,
      isPinned: false,
      photo: null,
    };
    return [shadow, ...prevs];
  }
  const updated = { ...prevs[i] };
  if (text) updated.lastMessageText = text;
  if (date) updated.lastMessageAt = date;
  updated.unreadCount = (updated.unreadCount ?? 0) + 1;

  const next = prevs.slice(0, i).concat(prevs.slice(i + 1));
  return [updated, ...next];
}

const UnifiedInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId, authorized, status } = useTelegramAuth();

  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(0);

  const LIMIT = 30;

  // ---- Initial fetch on mount or when auth/session changes ----
  useEffect(() => {
    if (status !== 'authorized' || !authorized || !sessionId) {
      console.warn('[UnifiedInboxPage] User not authorized for Telegram');
      setError('Please log in to Telegram');
      setLoading(false);
      setChats([]); // ensure blank when unauthorized
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setError(null);
    setLoading(true);
    console.log('[UnifiedInboxPage] Fetching chat previews...');
    // Perform fetch (duplicates are acceptable; AbortController cancels stale)
    fetchChatPreviews(sessionId, LIMIT)
      .then(data => {
        if (!cancelled) {
          setChats(data);
          setError(null);
          console.log(`[UnifiedInboxPage] Loaded ${data.length} chats`);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[UnifiedInboxPage] Error loading chats:', err);
          setError(err?.message || 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, authorized, status]);

  // ---- Live updates via WebSocket ----
  useEffect(() => {
    if (status !== 'authorized' || !authorized || !sessionId) return;

    function connect() {
      console.log('[UnifiedInboxPage] Connecting WebSocket for live updates...');
      const ws = new WebSocket(buildWsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => { 
        backoffRef.current = 0; 
        console.log('[UnifiedInboxPage] WebSocket connected');
      };

      ws.onmessage = (ev) => {
        try {
          const payload: UpdatePayload = JSON.parse(ev.data);
          if (payload.type === 'new_message') {
            console.log('[UnifiedInboxPage] Received new message update:', payload.data);
            setChats(prev => applyNewMessage(prev, payload.data));
          }
        } catch (e) {
          console.error('[UnifiedInboxPage] WS message parse error', e);
        }
      };

      ws.onerror = () => {
        console.error('[UnifiedInboxPage] WebSocket error');
        try { ws.close(); } catch {}
      };

      ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, backoffRef.current++), 15000);
        console.warn(`[UnifiedInboxPage] WebSocket closed, reconnecting in ${delay}ms`);
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [sessionId, authorized, status]);

  // Sort: pinned first, then by lastMessageAt desc
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });
  }, [chats]);

  if (loading && chats.length === 0) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4 space-y-2 overflow-auto w-full">
      {sortedChats.map(chat => (
        <button
          key={`${chat.peerType}:${chat.peerId}`}
          // Navigate to /inbox/chat/:peerType/:peerId and pass preview in state
          onClick={() =>
            navigate(`/inbox/chat/${chat.peerType}/${chat.peerId}`, { state: { chat } })
          }
          className="w-full text-left flex items-start p-3 bg-white rounded-lg shadow hover:bg-gray-50 cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex justify-between">
              <span className="font-semibold">{chat.title}</span>
              <span className="text-sm text-gray-500">
                {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString() : ''}
              </span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {chat.lastMessageText || <span className="italic text-gray-400">No messages</span>}
            </div>
          </div>
          {chat.unreadCount > 0 && (
            <div className="ml-2 flex items-center justify-center w-6 h-6 text-white bg-blue-500 rounded-full text-xs">
              {chat.unreadCount}
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default UnifiedInboxPage;
