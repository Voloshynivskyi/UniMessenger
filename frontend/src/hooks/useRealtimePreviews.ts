// File: frontend/src/hooks/useRealtimePreviews.ts
// Custom React hook for fetching and subscribing to chat previews in real time.

import { useEffect, useMemo, useRef, useState } from 'react';

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

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

/** Build a WS URL; prefer env override, otherwise infer from window location. */
function buildWsUrl(sessionId: string): string {
  // You can override backend WS base via an env var at build time, e.g. VITE_BACKEND_WS_BASE="ws://localhost:7007"
  const base =
    (import.meta as any).env?.VITE_BACKEND_WS_BASE ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:7007`;
  return `${base}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

/** Update the previews array given an incoming "new_message" payload. */
function applyNewMessage(prevs: ChatPreview[], data: any): ChatPreview[] {
  const peerId = String(data?.peerId || '');
  const text = typeof data?.text === 'string' ? data.text : '';
  const date = data?.date ?? null;

  if (!peerId) return prevs;

  const i = prevs.findIndex(p => p.peerId === peerId);
  if (i === -1) {
    // If chat not present yet, create a minimal shadow preview and put it on top
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

  // Update existing preview and move it to top
  const updated = { ...prevs[i] };
  if (text) updated.lastMessageText = text;
  if (date) updated.lastMessageAt = date;
  updated.unreadCount = (updated.unreadCount ?? 0) + 1;

  const next = prevs.slice(0, i).concat(prevs.slice(i + 1));
  return [updated, ...next];
}

export function useRealtimePreviews(sessionId: string, limit = 30) {
  const [previews, setPreviews] = useState<ChatPreview[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(0);

  // 1) Initial fetch of chat previews
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const url = `/api/telegram/chats?sessionId=${encodeURIComponent(sessionId)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data: ChatPreview[] = await res.json();
      if (!cancelled) setPreviews(data);
    }

    if (sessionId) load().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [sessionId, limit]);

  // 2) WebSocket connect + reconnect with exponential backoff
  useEffect(() => {
    if (!sessionId) return;

    function connect() {
      const wsUrl = buildWsUrl(sessionId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Reset backoff on successful connect
        backoffRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const payload: UpdatePayload = JSON.parse(ev.data);
          if (payload.type === 'new_message') {
            setPreviews(prev => applyNewMessage(prev, payload.data));
          }
          // Note: you can handle 'raw' updates here later (read/unread/pins/edits)
        } catch (e) {
          console.error('WS message parse error', e);
        }
      };

      ws.onerror = () => {
        // Rely on onclose to schedule reconnection
        try { ws.close(); } catch {}
      };

      ws.onclose = () => {
        // Exponential backoff: 1s, 2s, 4s, ... up to 15s
        const delay = Math.min(1000 * Math.pow(2, backoffRef.current++), 15000);
        timerRef.current = window.setTimeout(connect, delay);
      };
    }

    connect();

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
  }, [sessionId]);

  // 3) Sort previews: pinned first, then by lastMessageAt desc
  const sorted = useMemo(() => {
    return [...previews].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });
  }, [previews]);

  return { previews: sorted, setPreviews };
}
