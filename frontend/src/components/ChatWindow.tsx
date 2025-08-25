// File: frontend/src/components/ChatWindow.tsx
// Chat window with scrollable message list, sticky composer, auto-scroll,
// and robust de-duplication of messages (optimistic + WS echo).
//
// - Reads account from ?s=<sessionId>, peer from route params
// - Subscribes to account-level WS via wsHub and filters by peerKey
// - Maintains a Set of seen message keys to avoid duplicates
// - Comments in English as requested.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchMessages, sendMessage, type MessageDTO } from '../api/telegramMessages';
import { wsHub, type UpdatePayload } from '../lib/wsHub';

type RouteParams = { peerType: string; peerId: string };

function buildPeerKey(peerType: string, peerId: string): string {
  return `${peerType}:${peerId}`;
}

// Build a stable key for a message DTO coming from REST/send API
function keyFromDTO(m: MessageDTO): string {
  const idPart = m.id != null ? String(m.id) : '';
  const datePart = m.date || '';
  const textPart = m.text || '';
  const outPart = m.out ? '1' : '0';
  // PeerKey must be present on DTO per our API contract
  return `${m.peerKey}|${idPart || `d:${datePart}:${textPart}:${outPart}`}`;
}

// Build a stable key for a WS payload (may be partial)
function keyFromWS(peerKey: string, data: any): string {
  const idRaw = data?.id;
  const idPart = idRaw != null ? String(idRaw) : '';
  const datePart = data?.date || '';
  const textPart = typeof data?.text === 'string' ? data.text : '';
  const outPart = data?.out ? '1' : '0';
  return `${peerKey}|${idPart || `d:${datePart}:${textPart}:${outPart}`}`;
}

const AUTO_SCROLL_THRESHOLD = 120; // px distance from bottom to keep autoscrolling

const ChatWindow: React.FC = () => {
  const { accounts } = useTelegramAuth();
  const { peerType, peerId } = useParams<RouteParams>();
  const [sp] = useSearchParams();
  const sessionId = sp.get('s') || '';

  const activeAccount = useMemo(
    () => accounts.find(a => a.sessionId === sessionId),
    [accounts, sessionId]
  );
  const peerKey = useMemo(() => buildPeerKey(String(peerType), String(peerId)), [peerType, peerId]);

  const [msgs, setMsgs] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  // Seen message keys to prevent duplicates (optimistic + WS echo)
  const seenRef = useRef<Set<string>>(new Set());

  // Scroll refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const wantAutoScrollRef = useRef<boolean>(true); // whether we should auto-scroll on new messages

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    return dist < AUTO_SCROLL_THRESHOLD;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Reset state when changing account or peer
  useEffect(() => {
    // Reset messages and seen set to avoid cross-thread bleed-through
    setMsgs([]);
    seenRef.current = new Set();
    setLoading(true);
  }, [activeAccount, peerKey]);

  // Initial fetch + seed seen set
  useEffect(() => {
    if (!activeAccount) return;
    fetchMessages(activeAccount.sessionId, peerKey, 50)
      .then(list => {
        const next: MessageDTO[] = [];
        for (const m of list) {
          const k = keyFromDTO(m);
          if (seenRef.current.has(k)) continue;
          seenRef.current.add(k);
          next.push(m);
        }
        setMsgs(next);
      })
      .finally(() => {
        setLoading(false);
        // After initial load, jump to bottom smoothly
        setTimeout(() => scrollToBottom('auto'), 0);
      });
  }, [activeAccount, peerKey]);

  // Track manual scroll: toggle auto-scroll flag if user scrolls up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      wantAutoScrollRef.current = isNearBottom();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // WS subscription (per account), append only messages for this peerKey with de-dup
  useEffect(() => {
    if (!activeAccount) return;
    const unsub = wsHub.subscribe(activeAccount.sessionId, (payload: UpdatePayload) => {
      if (payload.type !== 'new_message') return;

      const incomingPeerKey: string | null =
        typeof payload.data?.peerKey === 'string'
          ? payload.data.peerKey
          : payload.data?.peerId != null
          ? `chat:${String(payload.data.peerId)}`
          : null;

      if (incomingPeerKey !== peerKey) return;

      // Build a key and dedupe
      const k = keyFromWS(peerKey, payload.data);
      if (seenRef.current.has(k)) return;
      seenRef.current.add(k);

      const dto: MessageDTO = {
        id: Number(payload.data?.id ?? Date.now()), // id usually present; fallback keeps UI stable
        peerKey,
        senderId: payload.data?.senderId ?? null,
        text: String(payload.data?.text ?? ''),
        date: payload.data?.date ?? new Date().toISOString(),
        out: Boolean(payload.data?.out ?? false),
        service: Boolean(payload.data?.service ?? false),
      };

      setMsgs(prev => {
        const next = [...prev, dto];
        if (wantAutoScrollRef.current) {
          queueMicrotask(() => scrollToBottom('auto'));
        }
        return next;
      });
    });
    return () => unsub();
  }, [activeAccount, peerKey]);

  const onSend = async () => {
    if (!activeAccount || !text.trim()) return;
    const payload = text.trim();
    setText('');
    // Ensure we keep autoscroll when sending
    wantAutoScrollRef.current = true;

    // Send and optimistically append; server will echo via WS, but we'll dedupe by key
    const res = await sendMessage(activeAccount.sessionId, peerKey, payload);

    const optimistic = res.message; // MessageDTO from REST
    const k = keyFromDTO(optimistic);
    if (!seenRef.current.has(k)) {
      seenRef.current.add(k);
      setMsgs(prev => {
        const next = [...prev, optimistic];
        queueMicrotask(() => scrollToBottom('auto'));
        return next;
      });
    }
  };

  if (!activeAccount) {
    return <div className="p-4 text-red-600">Оберіть акаунт через список чатів.</div>;
  }

  return (
    // h-full + min-h-0 are critical for nested scroll-in-flex
    <div className="h-full min-h-0 flex flex-col bg-white">
      {/* Scrollable messages list */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2"
      >
        {loading && <div>Loading…</div>}
        {!loading &&
          msgs.map(m => (
            <div key={keyFromDTO(m)} className={`w-full flex ${m.out ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] px-3 py-2 rounded-2xl whitespace-pre-wrap break-words ${
                  m.out ? 'bg-blue-500 text-white rounded-br-md' : 'bg-gray-200 text-gray-900 rounded-bl-md'
                }`}
              >
                <div className="text-sm">{m.text}</div>
                <div className={`text-[11px] mt-1 ${m.out ? 'opacity-80' : 'opacity-60'}`}>
                  {m.date ? new Date(m.date).toLocaleString() : ''}
                </div>
              </div>
            </div>
          ))}
        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Sticky composer at bottom (remains visible) */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Напишіть повідомлення…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) onSend();
            }}
          />
          <button
            onClick={onSend}
            className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
          >
            Надіслати
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
