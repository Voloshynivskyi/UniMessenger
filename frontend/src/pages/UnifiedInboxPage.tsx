// File: frontend/src/pages/UnifiedInboxPage.tsx
// Unified inbox with collapsible sections per account.
// Visual style: simple list (no cards), avatar circle on the left,
// bold title, gray last message, date on the right, unread badge.
// Uses a single WebSocket per account via wsHub and merges live updates.

// Comments are in English as requested.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import { fetchChatPreviews, type ChatPreview, type PeerType } from '../api/telegramChats';
import { wsHub, type UpdatePayload } from '../lib/wsHub';

// Build initials for avatar circle
function initials(title: string): string {
  const parts = title.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function readPeer(data: any): { peerType: PeerType; peerId: string } | null {
  if (typeof data?.peerKey === 'string' && data.peerKey.includes(':')) {
    const [t, id] = data.peerKey.split(':');
    if (id) return { peerType: t as PeerType, peerId: String(id) };
  }
  if (data?.peerId != null) return { peerType: 'chat', peerId: String(data.peerId) };
  return null;
}

function applyNewMessage(prevs: ChatPreview[], data: any): ChatPreview[] {
  const peer = readPeer(data);
  const text = typeof data?.text === 'string' ? data.text : '';
  const date = data?.date ?? null;
  if (!peer) return prevs;

  const idx = prevs.findIndex(p => p.peerId === peer.peerId && p.peerType === peer.peerType);
  if (idx === -1) {
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
  const updated = { ...prevs[idx] };
  if (text) updated.lastMessageText = text;
  if (date) updated.lastMessageAt = date;
  updated.unreadCount = (updated.unreadCount ?? 0) + 1;

  const next = prevs.slice(0, idx).concat(prevs.slice(idx + 1));
  return [updated, ...next];
}

type AccountState = {
  sessionId: string;
  username: string | null;
  open: boolean;
  chats: ChatPreview[];
  loading: boolean;
  error: string | null;
};

const UnifiedInboxPage: React.FC = () => {
  const { accounts } = useTelegramAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<AccountState[]>(() =>
    accounts.map(a => ({
      sessionId: a.sessionId,
      username: a.username ?? null,
      open: true,
      chats: [],
      loading: true,
      error: null,
    }))
  );

  // Keep state aligned with accounts list
  useEffect(() => {
    setState(prev => {
      const map = new Map(prev.map(p => [p.sessionId, p]));
      return accounts.map(a => {
        const old = map.get(a.sessionId);
        return old
          ? { ...old, username: a.username ?? old.username }
          : { sessionId: a.sessionId, username: a.username ?? null, open: true, chats: [], loading: true, error: null };
      });
    });
  }, [accounts]);

  // Load chats + subscribe to WS per account
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    state.forEach((acc, idx) => {
      // initial load
      fetchChatPreviews(acc.sessionId, 50)
        .then(list => {
          setState(cur => {
            const c = [...cur];
            c[idx] = { ...c[idx], chats: list, loading: false, error: null };
            return c;
          });
        })
        .catch(e => {
          setState(cur => {
            const c = [...cur];
            c[idx] = { ...c[idx], loading: false, error: e?.message || 'Failed to load' };
            return c;
          });
        });

      // WS subscribe
      const unsub = wsHub.subscribe(acc.sessionId, (payload: UpdatePayload) => {
        if (payload.type !== 'new_message') return;
        setState(cur => {
          const c = [...cur];
          const me = c.findIndex(s => s.sessionId === acc.sessionId);
          if (me === -1) return cur;
          c[me] = { ...c[me], chats: applyNewMessage(c[me].chats, payload.data) };
          return c;
        });
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(fn => fn());
    };
    // Only re-run when number of accounts changes (avoid resubscribing on minor state updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.length]);

  const toggle = (sid: string) => {
    setState(cur => cur.map(s => (s.sessionId === sid ? { ...s, open: !s.open } : s)));
  };

  const sorted = useMemo(() => {
    return state.map(s => ({
      ...s,
      chats: [...s.chats].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        return tb - ta;
      }),
    }));
  }, [state]);

  return (
    <div className="h-full overflow-auto">
      {sorted.map(acc => (
        <div key={acc.sessionId} className="border-b border-gray-200">
          {/* Section header */}
          <button
            onClick={() => toggle(acc.sessionId)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200"
          >
            <span className="font-semibold">
              {acc.username ? `@${acc.username}` : acc.sessionId.slice(0, 8)}
            </span>
            <span className="text-sm text-gray-600">{acc.open ? '▲' : '▼'}</span>
          </button>

          {/* Section body */}
          {acc.open && (
            <div className="divide-y">
              {acc.loading && <div className="p-4 text-gray-600">Loading…</div>}
              {acc.error && <div className="p-4 text-red-600">{acc.error}</div>}
              {!acc.loading && !acc.error && acc.chats.length === 0 && (
                <div className="p-4 text-gray-500">No chats yet</div>
              )}
              {!acc.loading &&
                !acc.error &&
                acc.chats.map(chat => (
                  <div
                    key={`${chat.peerType}:${chat.peerId}`}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      navigate(`/inbox/chat/${chat.peerType}/${chat.peerId}?s=${acc.sessionId}`, {
                        state: { chat },
                      })
                    }
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar circle */}
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-white">
                          {initials(chat.title || 'C')}
                        </span>
                      </div>

                      {/* Middle block: title + last message */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{chat.title}</span>
                          <span className="text-xs text-gray-500 ml-3">
                            {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {chat.lastMessageText || <span className="italic text-gray-400">No messages</span>}
                        </div>
                      </div>

                      {/* Unread badge */}
                      {chat.unreadCount > 0 && (
                        <div className="ml-2 min-w-[24px] h-6 px-2 flex items-center justify-center text-white bg-blue-500 rounded-full text-xs">
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UnifiedInboxPage;
