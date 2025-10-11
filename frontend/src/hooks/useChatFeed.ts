// File: frontend/src/hooks/useChatFeed.ts
// Owns: messages state, initial fetch, infinite scroll, ws subscription, optimistic replacement.

import React from 'react';
import { fetchMessages } from '../api/telegramMessages';
import { ensureSessionSocket, onSessionUpdate } from '../lib/wsHub';
import { toEpoch } from '../utils/chat';
import type { Msg } from '../types/chat';

const PAGE_SIZE = 50;
const DEDUP_WINDOW = 10_000; // ms

export type UseChatFeed = {
  listRef: React.RefObject<HTMLDivElement | null>;
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  loading: boolean;
  error: string | null;
  setError: (s: string | null) => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onListScroll: () => void;
  replaceOptimisticWithReal: (real: Msg) => boolean;
  outboxMapRef: React.MutableRefObject<Map<string, Array<{ localId: string; stamp: number }>>>;
};

export function useChatFeed(sessionId: string | null, peerKey: string): UseChatFeed {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingOlder, setLoadingOlder] = React.useState(false);

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const userPinnedScrollTopRef = React.useRef(false);
  const loadingOlderFlagRef = React.useRef(false); // guard against parallel fetches
  const lastReqRef = React.useRef(0);

  // Map: `${peerKey}|${trimmedText}` -> queue of optimistic entries
  const outboxMapRef = React.useRef<Map<string, Array<{ localId: string; stamp: number }>>>(new Map());

  const scrollToBottom = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const maybeAutoScroll = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 200;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom && !userPinnedScrollTopRef.current) scrollToBottom();
  }, [scrollToBottom]);

  // Initial load / reload
  React.useEffect(() => {
    if (!sessionId || !peerKey) return;
    let aborted = false;
    const reqId = Date.now();
    lastReqRef.current = reqId;

    setLoading(true);
    setError(null);
    setHasMore(true);

    (async () => {
      try {
        const raw = await fetchMessages(sessionId, peerKey, PAGE_SIZE);
        if (aborted || lastReqRef.current !== reqId) return;

        const list: Msg[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.messages)
          ? (raw as any).messages
          : [];

        setMessages(list);
        setHasMore(list.length >= PAGE_SIZE);
        setLoading(false);
        setTimeout(scrollToBottom, 0);
        setTimeout(scrollToBottom, 16);
      } catch (e: any) {
        if (aborted || lastReqRef.current !== reqId) return;
        setError(e?.message || 'Failed to load messages');
        setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [sessionId, peerKey, scrollToBottom]);

  // Replace optimistic
  const replaceOptimisticWithReal = React.useCallback((real: Msg): boolean => {
    const t = (real.text || '').trim();
    if (!t || !real.out) return false;
    const key = `${peerKey}|${t}`;
    const queue = outboxMapRef.current.get(key);
    if (!queue || queue.length === 0) return false;

    const realTs = toEpoch(real.date) ?? Date.now();
    let idxFound = -1;
    for (let i = 0; i < queue.length; i++) {
      const { stamp } = queue[i];
      if (Math.abs(realTs - stamp) <= DEDUP_WINDOW) { idxFound = i; break; }
    }
    if (idxFound === -1) return false;

    const { localId } = queue.splice(idxFound, 1)[0];
    if (queue.length === 0) outboxMapRef.current.delete(key);

    setMessages(prev => {
      const alreadyReal = prev.some(m => String(m.id) === String(real.id));
      const iOpt = prev.findIndex(m => String(m.id) === String(localId));
      if (iOpt >= 0) {
        const next = prev.slice();
        if (alreadyReal) { next.splice(iOpt, 1); return next; }
        next[iOpt] = real;
        return next;
      }
      return prev;
    });

    return true;
  }, [peerKey]);

  // WS subscription
  React.useEffect(() => {
    if (!sessionId) return;
    ensureSessionSocket(sessionId);

    const off = onSessionUpdate(sessionId, (payload: any) => {
      const p = payload || {};
      const data = p.data || p;
      const m: Msg = {
        id: data.id ?? data.messageId ?? Date.now(),
        peerKey: data.peerKey ?? (data.peerType && data.peerId != null ? `${data.peerType}:${data.peerId}` : ''),
        text: data.text ?? data.message ?? '',
        date: data.date ?? Date.now(),
        out: !!data.out,
        service: !!data.service,
      };

      if (!m.peerKey || m.peerKey !== peerKey) return;

      const replaced = replaceOptimisticWithReal(m);
      if (replaced) {
        setTimeout(maybeAutoScroll, 0);
        setTimeout(maybeAutoScroll, 16);
        return;
      }

      setMessages(prev => {
        const exists = prev.some(x => String(x.id) === String(m.id));
        if (exists) return prev;

        const mt = (m.text || '').trim();
        const mEpoch = toEpoch(m.date);
        if (mt && mEpoch != null) {
          const nearDup = prev.some(x => {
            if (!x.out || (x.text || '').trim() !== mt) return false;
            const xt = toEpoch(x.date);
            return xt != null && Math.abs(mEpoch - xt) <= DEDUP_WINDOW;
          });
          if (nearDup) return prev;
        }
        return [...prev, m];
      });

      setTimeout(maybeAutoScroll, 0);
      setTimeout(maybeAutoScroll, 16);
    });

    return () => off();
  }, [sessionId, peerKey, maybeAutoScroll, replaceOptimisticWithReal]);

  // Infinite scroll
  const loadOlder = React.useCallback(async () => {
    const el = listRef.current;
    if (!sessionId || !peerKey || !el) return;
    if (!hasMore) return;
    if (loadingOlderFlagRef.current) return;

    const firstNumericId = (() => {
      for (const m of messages) {
        if (typeof m.id === 'number') return m.id;
        const n = Number(m.id);
        if (Number.isFinite(n)) return n;
      }
      return null;
    })();
    if (firstNumericId == null) return;

    loadingOlderFlagRef.current = true;
    setLoadingOlder(true);

    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;

    try {
      const older = await fetchMessages(sessionId, peerKey, PAGE_SIZE, firstNumericId);
      if (!Array.isArray(older) || older.length === 0) setHasMore(false);

      setMessages(prev => {
        const combined = [...older, ...prev];
        const seen = new Set<string>();
        const result: Msg[] = [];
        for (const item of combined) {
          const key = String(item.id);
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(item);
        }
        return result;
      });

      setTimeout(() => {
        const afterHeight = el.scrollHeight;
        const delta = afterHeight - prevHeight;
        el.scrollTop = prevTop + delta;
      }, 0);
    } catch (e) {
      console.warn('[Chat] Failed to load older:', e);
    } finally {
      loadingOlderFlagRef.current = false;
      setLoadingOlder(false);
    }
  }, [sessionId, peerKey, messages, hasMore]);

  const onListScroll = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const bottomThreshold = 200;
    userPinnedScrollTopRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > bottomThreshold;

    const topThreshold = 80;
    if (el.scrollTop <= topThreshold) void loadOlder();
  }, [loadOlder]);

  return {
    listRef,
    messages,
    setMessages,
    loading,
    error,
    setError,
    hasMore,
    loadingOlder,
    onListScroll,
    replaceOptimisticWithReal,
    outboxMapRef,
  };
}
