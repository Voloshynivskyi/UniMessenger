// Purpose: Unified inbox for multiple Telegram accounts, each with its own live stream.

// File: frontend/src/pages/UnifiedInboxPage.tsx
// Unified inbox for MULTIPLE Telegram accounts.
// Renders one collapsible section per account, each with its own HTTP+WS stream.
// Clicking on a chat navigates to /inbox/chat/:peerType/:peerId with sessionId in state.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchChatPreviews, type ChatPreview } from '../api/telegramChats';
import { WS_BASE } from '../lib/http';

type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data: any };

// Build WS url for a specific account session
function buildWsUrl(sessionId: string): string {
  return `${WS_BASE()}/ws?sessionId=${encodeURIComponent(sessionId)}`;
}

// Apply "new message" to an array of previews (move updated to top)
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

const AccountSection: React.FC<{ sessionId: string; header: string }> = ({ sessionId, header }) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(true);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(0);

  const LIMIT = 30;

  // initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchChatPreviews(sessionId, LIMIT)
      .then(data => {
        if (!cancelled) {
          setChats(data);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId]);

  // live WS
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(buildWsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => { backoffRef.current = 0; };
      ws.onmessage = (ev) => {
        try {
          const payload: UpdatePayload = JSON.parse(ev.data);
          if (payload.type === 'new_message') {
            setChats(prev => applyNewMessage(prev, payload.data));
          }
        } catch (e) {
          // ignore parse errors
        }
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, backoffRef.current++), 15000);
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
  }, [sessionId]);

  // pinned first, then by lastMessageAt desc
  const sorted = useMemo(() => {
    return [...chats].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return tb - ta;
    });
  }, [chats]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b hover:bg-gray-50"
      >
        <span className="font-semibold">{header}</span>
        <span className="text-sm text-gray-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {!open ? null : (
        <div className="p-3 space-y-2">
          {loading && <div>Loading…</div>}
          {error && <div className="text-red-600">{error}</div>}
          {!loading && !error && sorted.map(chat => (
            <button
              key={`${chat.peerType}:${chat.peerId}`}
              onClick={() => navigate(`/inbox/chat/${chat.peerType}/${chat.peerId}`, {
                state: { chat, sessionId } // 👈 pass the correct account to chat page
              })}
              className="w-full text-left flex items-start p-3 bg-white rounded-lg border hover:bg-gray-50 cursor-pointer"
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
      )}
    </div>
  );
};

const UnifiedInboxPage: React.FC = () => {
  const { accounts } = useTelegramAuth();

  if (accounts.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
          No accounts connected. Go to <span className="font-semibold">Accounts</span> to add a Telegram account.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto w-full">
      {accounts.map((a, i) => (
        <AccountSection
          key={a.sessionId}
          sessionId={a.sessionId}
          header={a.username ? `@${a.username}` : `Account ${i + 1}`}
        />
      ))}
    </div>
  );
};

export default UnifiedInboxPage;
