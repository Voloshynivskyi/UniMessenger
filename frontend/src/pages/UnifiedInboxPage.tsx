// File: frontend/src/pages/UnifiedInboxPage.tsx
// Purpose: Unified inbox grouped by Telegram accounts (collapsible sections), with live updates.
// Notes:
// - Per-account fetch with x-session-id; WS per account.
// - Clean look: section headers, counters, unread pills, hover states.
// - Clicking chat navigates to /inbox/chat/:peerType/:peerId?s=<sessionId>.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import http from '../lib/http';
import { ensureSessionSocket, onSessionUpdate } from '../lib/wsHub';
import type { UpdatePayload } from '../lib/wsHub';
import { useTelegramAuth } from '../context/TelegramAuthContext';

type ChatPreview = {
  peerId: string | number;
  peerType: 'user' | 'chat' | 'channel' | string;
  title?: string | null;
  lastMessageText?: string | null;
  lastMessageAt?: string | number | null;
  unreadCount?: number;
  isPinned?: boolean;
  photo?: string | null;
};

type Account = {
  sessionId: string;
  username?: string | null;
  active?: boolean;
};

function makePeerKey(cp: { peerType: string; peerId: string | number }) {
  return `${cp.peerType}:${cp.peerId}`;
}
function formatTime(ts?: string | number | null): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}
function labelForAccount(acc: Account, idx: number) {
  return acc.username ? `@${acc.username}` : `Account #${idx + 1} (${acc.sessionId.slice(0, 8)})`;
}

const UnifiedInboxPage: React.FC = () => {
  const nav = useNavigate();
  const { accounts = [] } = useTelegramAuth() as { accounts: Account[] };

  const [lists, setLists] = React.useState<Record<string, ChatPreview[]>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  // ---- Load chats per account ----------------------------------------------
  React.useEffect(() => {
    let aborted = false;

    const initLoading: Record<string, boolean> = {};
    const initErrors: Record<string, string | null> = {};
    for (const acc of accounts) {
      initLoading[acc.sessionId] = true;
      initErrors[acc.sessionId] = null;
    }
    setLoading(initLoading);
    setErrors(initErrors);

    (async () => {
      await Promise.all(
        accounts.map(async (acc: Account) => {
          try {
            const res = await http.get<any>('/api/telegram/chats?limit=200', {
              sessionId: acc.sessionId,
            });
            if (aborted) return;
            const list: ChatPreview[] = Array.isArray(res)
              ? res
              : (res?.dialogs || res?.items || res?.chats || []);
            setLists((prev) => ({ ...prev, [acc.sessionId]: list }));
            setLoading((prev) => ({ ...prev, [acc.sessionId]: false }));
          } catch (e: any) {
            if (aborted) return;
            setErrors((prev) => ({
              ...prev,
              [acc.sessionId]: e?.message || 'Не вдалося завантажити діалоги',
            }));
            setLoading((prev) => ({ ...prev, [acc.sessionId]: false }));
          }
        })
      );
    })();

    return () => {
      aborted = true;
    };
  }, [accounts.map((a) => a.sessionId).join('|')]);

  // ---- WS updates per account ----------------------------------------------
  React.useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const acc of accounts) {
      ensureSessionSocket(acc.sessionId);
      unsubs.push(
        onSessionUpdate(acc.sessionId, (payload: UpdatePayload) => {
          const p: any = payload || {};
          const data = p.data || p;

          let peerKey: string | null = null;
          if (data?.peerKey) peerKey = String(data.peerKey);
          else if (data?.peerType && data?.peerId != null) peerKey = `${data.peerType}:${data.peerId}`;
          if (!peerKey) return;

          setLists((prev) => {
            const list = prev[acc.sessionId] || [];
            const idx = list.findIndex((c) => makePeerKey(c) === peerKey);
            if (idx < 0) return prev;

            const item = list[idx];
            const updated: ChatPreview = {
              ...item,
              lastMessageText: data.text ?? data.message ?? item.lastMessageText ?? '',
              lastMessageAt: data.date ?? Date.now(),
              unreadCount: data.out === false ? (item.unreadCount || 0) + 1 : item.unreadCount ?? 0,
            };
            const next = list.slice();
            next.splice(idx, 1);
            return { ...prev, [acc.sessionId]: [updated, ...next] };
          });
        })
      );
    }
    return () => {
      for (const off of unsubs) try { off(); } catch {}
    };
  }, [accounts.map((a) => a.sessionId).join('|')]);

  // ---- Navigation -----------------------------------------------------------
  const openChat = (acc: Account, c: ChatPreview) => {
    const url = `/inbox/chat/${encodeURIComponent(c.peerType)}/${encodeURIComponent(
      String(c.peerId)
    )}?s=${encodeURIComponent(acc.sessionId)}`;
    // Pass minimal state so ChatPage can instantly show proper title without extra fetch
    nav(url, { state: { chat: c } });
  };

  if (!accounts.length) {
    return (
      <div className="p-4 text-sm text-red-600">
        Немає підключених Telegram-акаунтів. Додайте акаунт у розділі <b>Accounts</b>.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="p-3 border-b bg-white">
        <h1 className="text-lg font-semibold">Unified Inbox</h1>
      </div>

      <div className="divide-y">
        {accounts.map((acc: Account, idx: number) => {
          const list = lists[acc.sessionId] || [];
          const isLoading = !!loading[acc.sessionId];
          const err = errors[acc.sessionId] || null;
          const isCollapsed = !!collapsed[acc.sessionId];

          return (
            <section key={acc.sessionId}>
              {/* Section header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer select-none sticky top-0 z-10"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [acc.sessionId]: !prev[acc.sessionId] }))
                }
              >
                <div className="font-medium">
                  {labelForAccount(acc, idx)}{' '}
                  <span className="opacity-60 text-sm">({list.length})</span>
                </div>
                <div className="text-sm opacity-60">{isCollapsed ? '▶' : '▼'}</div>
              </div>

              {/* Section body */}
              {!isCollapsed && (
                <ul className="divide-y">
                  {isLoading && (
                    <li className="p-4 text-sm opacity-70">Завантаження діалогів…</li>
                  )}
                  {err && (
                    <li className="p-4 text-xs text-amber-700 bg-amber-50 border border-amber-200">
                      {err}
                    </li>
                  )}
                  {!isLoading && !err && list.length === 0 && (
                    <li className="p-4 text-sm opacity-60">Чатів не знайдено</li>
                  )}
                  {list.map((c) => (
                    <li
                      key={`${c.peerType}:${c.peerId}`}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                      onClick={() => openChat(acc, c)}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                        {(c.title || '').slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{c.title || '(без назви)'}</div>
                          {c.unreadCount ? (
                            <span className="ml-auto text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                              {c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {c.lastMessageText || '—'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(c.lastMessageAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default UnifiedInboxPage;
