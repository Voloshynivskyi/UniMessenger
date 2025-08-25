// File: frontend/src/pages/ChatPage.tsx
// Page wrapper for a single chat. Ensures full-height layout with min-h-0
// so that the ChatWindow list can scroll inside.

import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import type { ChatPreview } from '../api/telegramChats';
import { useTelegramAuth } from '../context/TelegramAuthContext';

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

  const sessionId = sp.get('s');
  const chatFromState = (state as any)?.chat as ChatPreview | undefined;

  const heading = useMemo(() => {
    if (chatFromState?.title) return chatFromState.title;
    const pt = peerType ?? 'chat';
    return `${pt}:${peerId}`;
  }, [chatFromState, peerType, peerId]);

  const accountLabel = useMemo(() => {
    if (!sessionId) return 'No account';
    const acc = accounts.find(a => a.sessionId === sessionId);
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
          В URL немає параметра <code>?s=&lt;sessionId&gt;</code>. Оберіть чат зі списку у Unified Inbox.
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
