// File: frontend/src/components/ChatWindow.tsx
// Purpose: Chat view with scrollable list + composer + infinite scroll.
// - Optimistic local message gets replaced by real one (WS or POST response).
// - Robust fetch (array or {messages: []}), WS append, auto-scroll.
// - Infinite scroll: load older messages on reaching top (beforeId pagination).
// - Enter to send, Shift+Enter for newline.

import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getDefaultSessionId } from '../lib/http';
import { ensureSessionSocket, onSessionUpdate } from '../lib/wsHub';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchMessages, sendMessage } from '../api/telegramMessages';
import { sendMediaFile } from '../api/telegramMedia';

type Params = { peerType: string; peerId: string };

type Msg = {
  id: number | string;
  peerKey: string;
  text?: string | null;
  date?: number | string | null;
  out?: boolean;
  service?: boolean;
};

function useQuerySessionId(): string | null {
  const location = useLocation();
  return React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get('s') || p.get('session') || p.get('sessionId');
    return s ? s.trim() : null;
  }, [location.search]);
}

function resolveSessionIdFromCtx(ctx: any): string | null {
  return (
    ctx?.activeSessionId ||
    ctx?.sessionId ||
    ctx?.active?.sessionId ||
    ctx?.current?.sessionId ||
    (Array.isArray(ctx?.accounts) &&
      (ctx.accounts.find((a: any) => a?.active)?.sessionId ||
        ctx.accounts[0]?.sessionId)) ||
    null
  );
}

function makePeerKey(peerType: string, peerId: string) {
  return `${peerType}:${peerId}`;
}

function toEpoch(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

// English: choose a short placeholder text for optimistic media bubbles
function labelForFile(file: File | Blob): string {
  const name = (file as any).name ? String((file as any).name) : '';
  const mt = (file as any).type ? String((file as any).type) : '';
  if (mt.startsWith('image/')) return '[photo]';
  if (mt.startsWith('video/')) return '[video]';
  if (mt.startsWith('audio/')) return '[audio]';
  if (mt === 'application/pdf') return '[document]';
  if (name) return `[${name}]`;
  return '[document]';
}


const PAGE_SIZE = 50;

// Time window to treat WS echo == recently sent optimistic (ms)
const DEDUP_WINDOW = 10_000;

const ChatWindow: React.FC = () => {
  const { peerType = '', peerId = '' } = useParams<Params>();
  const peerKey = React.useMemo(() => makePeerKey(peerType, peerId), [peerType, peerId]);

  const ctx = useTelegramAuth() as any;
  const querySid = useQuerySessionId();
  const sessionId =
    (querySid || getDefaultSessionId() || resolveSessionIdFromCtx(ctx) || '').trim() || null;

  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Infinite scroll state
  const [loadingOlder, setLoadingOlder] = React.useState<boolean>(false);
  const loadingOlderRef = React.useRef<boolean>(false); // English: guard against concurrent fetches
  const [hasMore, setHasMore] = React.useState<boolean>(true);

  // Composer
  const [text, setText] = React.useState<string>('');
  const [sending, setSending] = React.useState<boolean>(false);

  // File upload state
  const [uploading, setUploading] = React.useState<boolean>(false);
  // Hidden file input ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Scroll helpers
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const userPinnedScrollTopRef = React.useRef<boolean>(false);

  // For race-cancel
  const lastReqRef = React.useRef<number>(0);

  // Map: key = `${peerKey}|${trimmedText}` -> queue of optimistic local entries
  // value items: { localId, stamp }
  const outboxMapRef = React.useRef<Map<string, Array<{ localId: string; stamp: number }>>>(
    new Map()
  );

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

  // ---- Load initial messages ------------------------------------------------
  React.useEffect(() => {
    if (!sessionId || !peerKey) return;

    let aborted = false;
    const reqId = Date.now();
    lastReqRef.current = reqId;

    setLoading(true);
    setError(null);
    setHasMore(true); // reset pagination on chat change

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
        // If returned less than a page, there may be no more history
        setHasMore(list.length >= PAGE_SIZE);
        setLoading(false);
        setTimeout(scrollToBottom, 0);
        setTimeout(scrollToBottom, 16); // ensure after layout on next frame
      } catch (e: any) {
        if (aborted || lastReqRef.current !== reqId) return;
        setError(e?.message || 'Failed to load messages');
        setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [sessionId, peerKey, scrollToBottom]);

  // ---- Helper: replace optimistic by real (no duplicate) --------------------
  const replaceOptimisticWithReal = React.useCallback(
    (real: Msg): boolean => {
      // Try precise match by our outbox key & time window
      const t = (real.text || '').trim();
      if (!t || !real.out) return false;
      const key = `${peerKey}|${t}`;
      const queue = outboxMapRef.current.get(key);
      if (!queue || queue.length === 0) return false;

      const realTs = toEpoch(real.date) ?? Date.now();
      // find the closest optimistic within window
      let idxFound = -1;
      for (let i = 0; i < queue.length; i++) {
        const { stamp } = queue[i];
        if (Math.abs(realTs - stamp) <= DEDUP_WINDOW) {
          idxFound = i;
          break;
        }
      }
      if (idxFound === -1) return false;

      const { localId } = queue.splice(idxFound, 1)[0];
      if (queue.length === 0) outboxMapRef.current.delete(key);

      setMessages((prev) => {
        // If WS already appended real (by id), just remove optimistic leftover
        const alreadyReal = prev.some((m) => String(m.id) === String(real.id));
        const iOpt = prev.findIndex((m) => String(m.id) === String(localId));

        if (iOpt >= 0) {
          const next = prev.slice();
          if (alreadyReal) {
            // remove optimistic, keep real
            next.splice(iOpt, 1);
            return next;
          } else {
            // replace optimistic with real in-place (preserves scroll)
            next[iOpt] = real;
            return next;
          }
        }
        // No optimistic found (maybe user refreshed) — let caller append as new
        return prev;
      });

      return true;
    },
    [peerKey]
  );

  // ---- WS subscription ------------------------------------------------------
  React.useEffect(() => {
    if (!sessionId) return;

    ensureSessionSocket(sessionId);

    const off = onSessionUpdate(sessionId, (payload: any) => {
      const p = payload || {};
      const data = p.data || p;

      const m: Msg = {
        id: data.id ?? data.messageId ?? Date.now(),
        peerKey:
          data.peerKey ??
          (data.peerType && data.peerId != null ? `${data.peerType}:${data.peerId}` : ''),
        text: data.text ?? data.message ?? '',
        date: data.date ?? Date.now(),
        out: !!data.out,
        service: !!data.service,
      };

      if (!m.peerKey || m.peerKey !== peerKey) return;

      // First try to replace optimistic to avoid duplicates
      const replaced = replaceOptimisticWithReal(m);
      if (replaced) {
        setTimeout(maybeAutoScroll, 0);
        setTimeout(maybeAutoScroll, 16); // ensure after layout on next frame
        return;
      }

      // Otherwise append if not already present
      setMessages((prev) => {
        const exists = prev.some((x) => String(x.id) === String(m.id));
        if (exists) return prev;

        // Extra safety: shallow dedup by (out,text,date) within small window
        const mt = (m.text || '').trim();
        const mEpoch = toEpoch(m.date);
        if (mt && mEpoch != null) {
          const nearDup = prev.some((x) => {
            if (!x.out || (x.text || '').trim() !== mt) return false;
            const xt = toEpoch(x.date);
            return xt != null && Math.abs(mEpoch - xt) <= DEDUP_WINDOW;
          });
          if (nearDup) return prev;
        }

        return [...prev, m];
      });

      setTimeout(maybeAutoScroll, 0);
      setTimeout(maybeAutoScroll, 16); // next frame
    });

    return () => off();
  }, [sessionId, peerKey, maybeAutoScroll, replaceOptimisticWithReal]);

  // ---- Infinite scroll: load older on reaching top --------------------------
  const loadOlder = React.useCallback(async () => {
    const el = listRef.current;
    if (!sessionId || !peerKey || !el) return;
    if (!hasMore) return;
    if (loadingOlderRef.current) return;

    // English: find the smallest numeric message id to use as beforeId
    const firstNumericId = (() => {
      for (const m of messages) {
        if (typeof m.id === 'number') return m.id;
        const n = Number(m.id);
        if (Number.isFinite(n)) return n;
      }
      return null;
    })();

    if (firstNumericId == null) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;

    try {
      const older = await fetchMessages(sessionId, peerKey, PAGE_SIZE, firstNumericId);

      // If backend returned less than a page, likely no more pages
      if (!Array.isArray(older) || older.length === 0) {
        setHasMore(false);
      }

      // Prepend with de-duplication, preserving ascending order
      setMessages((prev) => {
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

      // Restore scroll position so content doesn't jump
      setTimeout(() => {
        const afterHeight = el.scrollHeight;
        const delta = afterHeight - prevHeight;
        el.scrollTop = prevTop + delta;
      }, 0);
    } catch (e) {
      // Optional: surface error softly
      // (We don't set global error to not pollute composer; dev can open console)
      console.warn('[ChatWindow] Failed to load older messages:', e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [sessionId, peerKey, messages, hasMore]);

  const onListScroll = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;

    // Track whether user is near bottom (to enable auto-scroll on new messages)
    const bottomThreshold = 200;
    userPinnedScrollTopRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight > bottomThreshold;

    // Trigger older load when close to top
    const topThreshold = 80;
    if (el.scrollTop <= topThreshold) {
      void loadOlder();
    }
  }, [loadOlder]);

  // ---- Send message ---------------------------------------------------------
  const doSend = React.useCallback(
    async (bodyText: string) => {
      if (!sessionId || !peerKey) return;
      const t = bodyText.trim();
      if (!t) return;

      setSending(true);

      // Optimistic message
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const optimistic: Msg = {
        id: localId,
        peerKey,
        text: t,
        date: now,
        out: true,
        service: false,
      };

      // Register in outbox map
      const key = `${peerKey}|${t}`;
      const queue = outboxMapRef.current.get(key) || [];
      queue.push({ localId, stamp: now });
      outboxMapRef.current.set(key, queue);

      // Append optimistic and scroll
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 16);

      try {
        const resp = await sendMessage(sessionId, peerKey, t);
        // English: unwrap backend DTO safely to satisfy TS and avoid {} type issues
        const payload: any =
          resp && typeof resp === 'object' && 'message' in (resp as any)
            ? (resp as any).message
            : resp;

        const real: Msg = {
          id: Number(payload?.id ?? now),
          peerKey: String(payload?.peerKey || peerKey),
          text: String(payload?.text ?? t),
          date: payload?.date ?? now,
          out: true,
          service: !!payload?.service,
        };

        if (real) {
          // Replace optimistic immediately (in case WS lags)
          replaceOptimisticWithReal(real);
        }
        // If no immediate payload — WS echo will handle replacement.
      } catch (e: any) {
        // Remove optimistic on failure
        setMessages((prev) => prev.filter((m) => String(m.id) !== localId));
        // Clean up map
        const arr = outboxMapRef.current.get(key) || [];
        outboxMapRef.current.set(
          key,
          arr.filter((x) => x.localId !== localId)
        );
        if ((outboxMapRef.current.get(key) || []).length === 0) {
          outboxMapRef.current.delete(key);
        }

        setError(e?.message || 'Failed to send message');
      } finally {
        setSending(false);
      }
    },
    [sessionId, peerKey, replaceOptimisticWithReal]
  );


  const onAttachClick = React.useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const onFileSelected = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    // Allow selecting the same file twice in a row
    e.target.value = '';
    if (!f || !sessionId || !peerKey) return;

    // Optional: use current text as caption (then clear it after send)
    const cap = text.trim() ? text.trim() : undefined;

    setUploading(true);

    // Optimistic bubble
    const localId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const optimisticText = cap ?? labelForFile(f);
    const optimistic: Msg = {
      id: localId,
      peerKey,
      text: optimisticText,
      date: now,
      out: true,
      service: false,
    };

    // Register in outbox by text to enable replacement (same logic as for text messages)
    if (optimisticText.trim()) {
      const key = `${peerKey}|${optimisticText.trim()}`;
      const queue = outboxMapRef.current.get(key) || [];
      queue.push({ localId, stamp: now });
      outboxMapRef.current.set(key, queue);
    }

    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, 0);
    setTimeout(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, 16);

    try {
      const resp = await sendMediaFile(sessionId, peerKey, f, {
        caption: cap,
        // forceDocument: true, // uncomment if you want always send as document
      });

      // English: unwrap to be safe
      const payload: any =
        resp && typeof resp === 'object' && 'message' in (resp as any)
          ? (resp as any).message
          : resp;

      const real: Msg = {
        id: Number(payload?.id ?? now),
        peerKey: String(payload?.peerKey || peerKey),
        text: String(payload?.text ?? (cap ?? labelForFile(f))),
        date: payload?.date ?? now,
        out: true,
        service: !!payload?.service,
      };

      // Replace optimistic once backend responds (WS may also come)
      replaceOptimisticWithReal(real);
      // If ми використовували текст як caption — можна очистити поле вводу
      if (cap) setText('');
    } catch (err: any) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => String(m.id) !== localId));
      // Cleanup dedup map
      const key = `${peerKey}|${optimisticText.trim()}`;
      const arr = outboxMapRef.current.get(key) || [];
      outboxMapRef.current.set(
        key,
        arr.filter((x) => x.localId !== localId)
      );
      if ((outboxMapRef.current.get(key) || []).length === 0) {
        outboxMapRef.current.delete(key);
      }
      setError(err?.message || 'Failed to send file');
    } finally {
      setUploading(false);
    }
  }, [sessionId, peerKey, text, replaceOptimisticWithReal]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const v = text;
      if (v.trim()) {
        setText('');
        void doSend(v);
      }
    }
  };

  if (!sessionId) {
    return (
      <div className="p-4 text-sm text-red-600">
        SessionId not found. Open chat via Unified Inbox or add ?s=&lt;sessionId&gt; to the URL.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-auto p-4 space-y-2 bg-gray-50"
        onScroll={onListScroll}
      >
        {/* Top marker for the very start of the chat history */}
        {!loadingOlder && !hasMore && messages.length > 0 && (
          <div className="text-center text-[11px] text-gray-400 mb-2">
            This is the beginning of history
          </div>
        )}

        {/* Top loader for older history */}
        {loadingOlder && (
          <div className="text-center text-xs text-gray-500 py-1">Loading history…</div>
        )}

        {loading && messages.length === 0 && (
          <div className="opacity-60 text-sm">Loading messages…</div>
        )}
        {error && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
            {error}
          </div>
        )}

        {messages.map((m) => {
          const isOut = !!m.out;
          const content =
            m.text && m.text.trim().length ? m.text : m.service ? '[service]' : '[без тексту]';
          const timeLabel =
            m.date != null
              ? new Date(typeof m.date === 'number' ? m.date : Date.parse(String(m.date))).toLocaleString()
              : '';
          return (
            <div key={String(m.id)} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] p-2 rounded-lg shadow text-sm whitespace-pre-wrap break-words ${
                  isOut ? 'bg-blue-600 text-white' : 'bg-white'
                }`}
                title={timeLabel}
              >
                {content}
              </div>
            </div>
          );
        })}

        {!loading && messages.length === 0 && !error && (
          <div className="opacity-60 text-sm">No messages</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-white p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={onAttachClick}
            disabled={uploading}
            title={uploading ? 'Uploading…' : 'Attach file'}
            className={`px-3 py-2 rounded-lg border ${
              uploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
            }`}
          >
            📎
          </button>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
            rows={1}
          />
          <button
            disabled={sending || uploading || !text.trim()}
            onClick={() => {
              const v = text;
              setText('');
              void doSend(v);
            }}
            className={`px-4 py-2 rounded-lg ${
              sending || !text.trim()
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Send
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">Enter — send, Shift+Enter — new line</div>
      </div>
    </div>
  );
};

export default ChatWindow;
