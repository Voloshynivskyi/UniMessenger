// File: frontend/src/components/UnifiedInbox.tsx
// Unified inbox component, displays chat previews and handles live updates.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchChatPreviews } from '../api/telegramChats';
import type { ChatPreview } from '../api/telegramChats';
import { useTelegramAuth } from '../context/TelegramAuthContext';

/** Build a WS URL; env override is supported via VITE_BACKEND_WS_BASE */
function buildWsUrl(sessionId: string): string {
  // If you define VITE_BACKEND_WS_BASE at build time (e.g. ws://localhost:7007),
  // we will use it. Otherwise, infer from current page hostname on port 7007.
  const base =
    (import.meta as any).env?.VITE_BACKEND_WS_BASE ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:7007`;
  return `${base}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

/** Apply an incoming "new_message" update to an array of chat previews. */
function applyNewMessage(prevs: ChatPreview[], data: any): ChatPreview[] {
  const peerId = String(data?.peerId || '');
  const text = typeof data?.text === 'string' ? data.text : '';
  const date = data?.date ?? null;

  if (!peerId) return prevs;

  const i = prevs.findIndex(p => p.peerId === peerId);
  if (i === -1) {
    // Chat not present yet → create a minimal shadow preview at the top
    const shadow: ChatPreview = {
      peerId,
      title: 'Unknown',
      peerType: 'chat',
      lastMessageText: text,
      lastMessageAt: date,
      unreadCount: 1,
      isPinned: false,
      photo: null,
    };
    return [shadow, ...prevs];
  }

  // Update existing preview and move it to the top
  const updated = { ...prevs[i] };
  if (text) updated.lastMessageText = text;
  if (date) updated.lastMessageAt = date;
  updated.unreadCount = (updated.unreadCount ?? 0) + 1;

  const next = prevs.slice(0, i).concat(prevs.slice(i + 1));
  return [updated, ...next];
}

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

const UnifiedInbox: React.FC = () => {
  const { sessionId, authorized, status } = useTelegramAuth();

  // UI state
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WS refs for lifecycle management
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(0); // exponential reconnect backoff counter

  // 1) Initial fetch once we are authorized
  useEffect(() => {
    if (status !== 'authorized' || !authorized || !sessionId) {
      console.warn('[UnifiedInbox] User not authorized for Telegram');
      setError('Please log in to Telegram');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setLoading(true);
    console.log('[UnifiedInbox] Fetching chat previews...');
    fetchChatPreviews(sessionId, 30)
      .then(data => {
        if (!cancelled) {
          setChats(data);
          setError(null);
          console.log(`[UnifiedInbox] Loaded ${data.length} chats`);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[UnifiedInbox] Error loading chats:', err);
          setError(err?.message || 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, authorized, status]);

  // 2) WebSocket connect + auto-reconnect
  useEffect(() => {
    if (status !== 'authorized' || !authorized || !sessionId) return;

    function connect() {
      console.log('[UnifiedInbox] Connecting WebSocket for live updates...');
      const wsUrl = buildWsUrl(sessionId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 0;
        console.log('[UnifiedInbox] WebSocket connected');
      };

      ws.onmessage = (ev) => {
        try {
          const payload: UpdatePayload = JSON.parse(ev.data);
          if (payload.type === 'new_message') {
            console.log('[UnifiedInbox] Received new message update:', payload.data);
            setChats(prev => applyNewMessage(prev, payload.data));
          }
        } catch (e) {
          console.error('[UnifiedInbox] WS message parse error', e);
        }
      };

      ws.onerror = () => {
        console.error('[UnifiedInbox] WebSocket error');
        try { ws.close(); } catch {}
      };

      ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, backoffRef.current++), 15000);
        console.warn(`[UnifiedInbox] WebSocket closed, reconnecting in ${delay}ms`);
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
  }, [sessionId, authorized, status]);

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
    return <div className="p-4">Loading...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 space-y-2">
      {sortedChats.map(chat => (
        <div
          key={chat.peerId}
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
              {chat.lastMessageText || (
                <span className="italic text-gray-400">No messages</span>
              )}
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
