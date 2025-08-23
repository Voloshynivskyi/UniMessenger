// src/components/ChatWindow.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatPreview } from '../api/telegramChats';
import type { MessageDTO } from '../api/telegramMessages';
import { fetchMessages } from '../api/telegramMessages';
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
  chat: ChatPreview;
  onBack: () => void;
}

const ChatWindow: React.FC<Props> = ({ sessionId, chat, onBack }) => {
  const peerKey = useMemo(() => `${chat.peerType}:${chat.peerId}`, [chat.peerType, chat.peerId]);

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const listRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMessages(sessionId, peerKey, 50)
      .then(data => {
        if (!cancelled) {
          setMessages(data);
          setHasMore(data.length >= 50);
          setTimeout(scrollToBottom, 0);
        }
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Помилка завантаження'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId, peerKey]);

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

  useEffect(() => {
    const ws = new WebSocket(buildWsUrl(sessionId));

    ws.onmessage = (ev) => {
      try {
        const payload: UpdatePayload = JSON.parse(ev.data);
        if (payload.type !== 'new_message') return;

        const p = payload.data || {};
        const pk = String(p.peerKey || '');
        if (pk !== peerKey) return;

        const dto: MessageDTO = {
          id: Number(p.id || Date.now()),
          peerKey,
          senderId: p.senderId ? String(p.senderId) : null,
          text: typeof p.text === 'string' ? p.text : '',
          date: p.date || new Date().toISOString(),
          out: Boolean(p.out),
          service: false,
        };

        setMessages(prev => {
          const last = prev.length ? prev[prev.length - 1] : null;
          if (last && dto.id && last.id && dto.id <= last.id) return prev;
          const next = [...prev, dto];
          next.sort((a, b) => (a.id || 0) - (b.id || 0));
          return next;
        });
        setTimeout(scrollToBottom, 0);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
    return () => { try { ws.close(); } catch {} };
  }, [sessionId, peerKey]);

  const title = chat.title || 'Chat';

  if (loading && messages.length === 0) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200 mr-3">← Назад</button>
        Завантаження повідомлень...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-red-500">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200 mr-3">← Назад</button>
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <button onClick={onBack} className="px-3 py-1 rounded bg-gray-200">← Назад</button>
        <div className="font-semibold">{title}</div>
      </div>

      <div className="px-3 py-2 border-b bg-white">
        <button
          onClick={loadOlder}
          disabled={!hasMore || olderLoading}
          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          {olderLoading ? 'Завантаження...' : hasMore ? 'Показати старіші' : 'Старіших немає'}
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 bg-gray-50">
        {messages.map(m => (
          <div key={m.id} className={`mb-2 flex ${m.out ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] px-3 py-2 rounded-lg shadow
              ${m.service ? 'bg-gray-300 text-gray-700' : m.out ? 'bg-blue-500 text-white' : 'bg-white'}
            `}>
              {!m.service ? (
                <>
                  <div className="whitespace-pre-wrap break-words">{m.text || ' '}</div>
                  <div className="text-[10px] opacity-70 text-right">
                    {m.date ? new Date(m.date).toLocaleString() : ''}
                  </div>
                </>
              ) : (
                <div className="text-xs italic">{m.text || '[service]'}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatWindow;
