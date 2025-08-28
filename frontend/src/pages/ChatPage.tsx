// File: frontend/src/pages/ChatPage.tsx
// Page wrapper for a single chat. Ensures full-height layout with min-h-0
// so that the ChatWindow list can scroll inside. Also resolves a human-friendly
// chat title by looking it up in /api/telegram/chats when not provided via state.

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import type { ChatPreview } from '../api/telegramChats';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import http from '../lib/http';

type RouteParams = {
  peerType: 'user' | 'chat' | 'channel';
  peerId: string;
};

const ChatPage: React.FC = () => {
  const { peerType, peerId } = useParams<RouteParams>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { accounts } = useTelegramAuth();

  // Cookie-less session (required)
  const sessionId = sp.get('s');

  // Chat passed via navigation state (when coming from list)
  const chatFromState = (state as any)?.chat as ChatPreview | undefined;

  // Build a stable peerKey (backend uses `${peerType}:${peerId}`)
  const peerKey = useMemo(
    () => `${peerType ?? 'chat'}:${peerId ?? ''}`,
    [peerType, peerId]
  );

  // Human-friendly title to display in header
  const [chatTitle, setChatTitle] = useState<string>(chatFromState?.title || '');

  // Resolve title when not provided by state (e.g., opened via direct URL)
  useEffect(() => {
    // If title already provided by state — use it
    if (chatFromState?.title) {
      setChatTitle(chatFromState.title);
      return;
    }
    // If no session or no peerKey — fallback to technical key
    if (!sessionId || !peerKey) {
      setChatTitle(`${peerType ?? 'chat'}:${peerId ?? ''}`);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Fetch chats for the account and find our peer
        const res = await http.get<any>('/api/telegram/chats?limit=200', { sessionId });
        if (cancelled) return;

        const list: ChatPreview[] = Array.isArray(res)
          ? res
          : (res?.dialogs || res?.items || res?.chats || []);

        const found = Array.isArray(list)
          ? list.find((c: any) => `${c.peerType}:${c.peerId}` === peerKey)
          : null;

        setChatTitle(found?.title || `${peerType ?? 'chat'}:${peerId ?? ''}`);
      } catch {
        if (!cancelled) {
          setChatTitle(`${peerType ?? 'chat'}:${peerId ?? ''}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, peerKey, chatFromState?.title, peerType, peerId]);

  // Header heading (prefer resolved human title)
  const heading = useMemo(
    () => chatTitle || `${peerType ?? 'chat'}:${peerId}`,
    [chatTitle, peerType, peerId]
  );

  // Account label for header (username if present, else short session id)
  const accountLabel = useMemo(() => {
    if (!sessionId) return 'No account';
    const acc = accounts.find((a) => a.sessionId === sessionId);
    if (!acc) return sessionId.slice(0, 8);
    return acc.username ? `@${acc.username}` : acc.sessionId.slice(0, 8);
  }, [accounts, sessionId]);

  const onBack = () => {
    navigate('/inbox');
  };

  if (!sessionId) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <div className="border-b p-3 flex items-center gap-3">
          <button
            className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300"
            onClick={onBack}
          >
            ← Back
          </button>
          <div className="font-semibold">Select account</div>
        </div>
        <div className="p-4 text-red-500">
          No <code>?s=&lt;sessionId&gt;</code> parameter in URL. Please select a chat from the Unified Inbox list.
        </div>
      </div>
    );
  }

  return (
    // min-h-0 is critical for scroll inside flex children
    <div className="h-full min-h-0 flex flex-col">
      <div className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300"
            onClick={onBack}
          >
            ← Back
          </button>
          <div>
            <div className="font-semibold">{heading}</div>
            <div className="text-sm text-gray-500">Account: {accountLabel}</div>
          </div>
        </div>
      </div>

      {/* The content area must also have min-h-0 so inner list can scroll */}
      <div className="flex-1 min-h-0">
        <ChatWindow />
      </div>
    </div>
  );
};

export default ChatPage;
