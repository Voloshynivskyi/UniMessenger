// File: frontend/src/pages/ChatPage.tsx
// Purpose: Chat page for a single chat, for a specific account (sessionId passed via state).

import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import type { ChatPreview } from '../api/telegramChats';

const ChatPage: React.FC = () => {
  const { peerType, peerId } = useParams<{ peerType: 'user'|'chat'|'channel', peerId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();

  const sessionId: string | undefined = (state as any)?.sessionId;
  const chatFromState: ChatPreview | undefined = (state as any)?.chat;

  if (!sessionId || !peerType || !peerId) {
    navigate('/inbox', { replace: true });
    return null;
  }

  const chat: ChatPreview = chatFromState ?? {
    peerId: peerId || '',
    peerType: (peerType as any) || 'chat',
    title: `${peerType}:${peerId}`,
    lastMessageText: null,
    lastMessageAt: null,
    unreadCount: 0,
    isPinned: false,
    photo: null,
  };

  return (
    <div className="w-full h-full">
      <ChatWindow
        sessionId={sessionId}
        chat={chat}
        onBack={() => navigate(-1)}
      />
    </div>
  );
};

export default ChatPage;
