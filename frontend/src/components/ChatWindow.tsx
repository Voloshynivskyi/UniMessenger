// File: frontend/src/components/ChatWindow.tsx
// Chat window component, displays messages and handles sending/receiving.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatPreview } from '../api/telegramChats';
import type { MessageDTO } from '../api/telegramMessages';
import { fetchMessages, sendMessage } from '../api/telegramMessages';
import { WS_BASE } from '../lib/http';

/** Build WS url against same-origin (proxy or env) */
function buildWsUrl(sessionId: string): string {
  return `${WS_BASE()}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

interface Props {
  sessionId: string;
  chat: ChatPreview;          // selected chat (from inbox or URL)
  onBack: () => void;         // go back handler
}

// Local view type with optional _local flag for optimistic items
type MessageView = MessageDTO & { _local?: boolean };

const ChatWindow: React.FC<Props> = ({ sessionId, chat, onBack }) => {
  const peerKey = useMemo(() => `${chat.peerType}:${chat.peerId}`, [chat.peerType, chat.peerId]);

  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  // ---- initial load ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    console.log('[ChatWindow] Fetching messages for chat:', peerKey);

    fetchMessages(sessionId, peerKey, 50)
      .then(data => {
        if (!cancelled) {
          setMessages(data);
          setHasMore(data.length >= 50);
          setTimeout(scrollToBottom, 0);
          console.log(`[ChatWindow] Loaded ${data.length} messages`);
        }
      })
      .catch(err => { 
        if (!cancelled) {
          console.error('[ChatWindow] Error loading messages:', err);
          setError(err?.message || 'Error loading'); 
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId, peerKey]);

  // ---- pagination up ----
  async function loadOlder() {
    if (olderLoading || !messages.length) return;
    setOlderLoading(true);
    try {
      const firstId = messages[0]?.id;
      const older = await fetchMessages(sessionId, peerKey, 50, firstId);
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setMessages(prev => [...older, ...prev]);
        const el = listRef.current;
        if (el) {
          const prevHeight = el.scrollHeight;
          setTimeout(() => {
            const newHeight = el.scrollHeight;
            el.scrollTop = newHeight - prevHeight + el.scrollTop;
          }, 0);
        }
      }
    } catch (e: any) {
      console.error('loadOlder error', e);
    } finally {
      setOlderLoading(false);
    }
  }

  // ---- WS live ----
  useEffect(() => {
    console.log('[ChatWindow] Connecting WebSocket for chat:', peerKey);
    const ws = new WebSocket(buildWsUrl(sessionId));

    ws.onmessage = (ev) => {
      try {
        const payload: UpdatePayload = JSON.parse(ev.data);
        if (payload.type !== 'new_message') return;

        const p = payload.data || {};
        const pk = String(p.peerKey || '');
        if (pk !== peerKey) return; // not our chat

        console.log('[ChatWindow] Received new message via WebSocket:', p);

        const incoming: MessageView = {
          id: Number(p.id || Date.now()),
          peerKey,
          senderId: p.senderId ? String(p.senderId) : null,
          text: typeof p.text === 'string' ? p.text : '',
          date: p.date || new Date().toISOString(),
          out: Boolean(p.out),
          service: Boolean(p.service),
        };

        setMessages(prev => {
          // 1) If we already have this id — replace (ensures no _local leftovers)
          const byId = prev.findIndex(m => m.id === incoming.id);
          if (byId !== -1) {
            const next = prev.slice();
            next[byId] = { ...incoming };
            next.sort((a, b) => (a.id || 0) - (b.id || 0));
            return next;
          }

          // 2) Try to reconcile with the latest optimistic local message (fallback)
          const localIdxFromEnd = [...prev].reverse().findIndex(m =>
            m._local && m.out && incoming.out && m.text === incoming.text
          );
          if (localIdxFromEnd !== -1) {
            const idx = prev.length - 1 - localIdxFromEnd;
            const next = prev.slice();
            next[idx] = { ...incoming };
            next.sort((a, b) => (a.id || 0) - (b.id || 0));
            return next;
          }

          // 3) Otherwise append if it's newer than last
          const last = prev.length ? prev[prev.length - 1] : null;
          if (last && incoming.id && last.id && incoming.id <= last.id) return prev;
          const next = [...prev, incoming];
          next.sort((a, b) => (a.id || 0) - (b.id || 0));
          return next;
        });
        setTimeout(scrollToBottom, 0);
      } catch (e) {
        console.error('[ChatWindow] WS parse error', e);
      }
    };

    ws.onerror = () => { 
      console.error('[ChatWindow] WebSocket error');
      try { ws.close(); } catch {} 
    };
    return () => { try { ws.close(); } catch {} };
  }, [sessionId, peerKey]);

  // ---- send message (optimistic + authoritative replace by HTTP response) ----
  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    console.log('[ChatWindow] Sending message:', text);

    // Create optimistic message
    const tempId = Date.now();
    const optimistic: MessageView = {
      id: tempId,
      peerKey,
      senderId: null,
      text,
      date: new Date().toISOString(),
      out: true,
      service: false,
      _local: true,
    };
    setMessages(prev => {
      const next = [...prev, optimistic];
      next.sort((a, b) => (a.id || 0) - (b.id || 0));
      return next;
    });
    setInput('');
    setTimeout(scrollToBottom, 0);

    setSending(true);
    try {
      const resp = await sendMessage(sessionId, peerKey, text);
      const real = resp?.message as MessageDTO | undefined;

      if (real) {
        console.log('[ChatWindow] Message sent successfully:', real);
        setMessages(prev => {
          const next = prev.slice();
          // A) replace by tempId if still present
          const idxByTemp = next.findIndex(m => m._local && m.id === tempId);
          if (idxByTemp !== -1) {
            next[idxByTemp] = { ...real };
            next.sort((a, b) => (a.id || 0) - (b.id || 0));
            return next;
          }
          // B) maybe WS already added real — ensure no duplicate
          const idxById = next.findIndex(m => m.id === real.id);
          if (idxById !== -1) {
            next[idxById] = { ...(next[idxById]), ...real };
            next.sort((a, b) => (a.id || 0) - (b.id || 0));
            return next;
          }
          // C) else append
          next.push({ ...real });
          next.sort((a, b) => (a.id || 0) - (b.id || 0));
          return next;
        });
      }
      // Note: WS таймінг тепер неважливий — ми вже оновили UI по HTTP-відповіді.
    } catch (e: any) {
      console.error('[ChatWindow] Error sending message:', e);
      // On error, mark the optimistic bubble as failed
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, text: `${m.text}\n(не надіслано: ${e?.message || 'помилка'})`, _local: false } : m
      ));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const title = chat.title || 'Chat';

  if (loading && messages.length === 0) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200 mr-3">← Back</button>
        Loading messages...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-red-500">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200 mr-3">← Back</button>
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200">← Back</button>
        <div className="font-semibold">{title}</div>
      </div>

      {/* Older button */}
      <div className="px-3 py-2 border-b bg-white">
        <button
          onClick={loadOlder}
          disabled={!hasMore || olderLoading}
          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          {olderLoading ? 'Loading...' : hasMore ? 'Show older' : 'No older messages'}
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 bg-gray-50">
        {messages.map(m => (
          <div key={m.id} className={`mb-2 flex ${m.out ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] px-3 py-2 rounded-lg shadow
              ${m.service ? 'bg-gray-300 text-gray-700' : m.out ? 'bg-blue-500 text-white' : 'bg-white'}
              ${m._local ? 'opacity-80' : ''}
            `}>
              {!m.service ? (
                <>
                  <div className="whitespace-pre-wrap break-words">{m.text || ' '}</div>
                  <div className="text-[10px] opacity-70 text-right">
                    {m.date ? new Date(m.date).toLocaleString() : ''}
                    {m._local && ' • sending...'}
                  </div>
                </>
              ) : (
                <div className="text-xs italic">{m.text || '[service]'}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600"
            title="Send (Enter)"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
