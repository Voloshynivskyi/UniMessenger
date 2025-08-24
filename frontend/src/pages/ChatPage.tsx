// File: frontend/src/pages/ChatPage.tsx
// Chat page, displays a single chat window for a selected peer.

import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTelegramAuth } from '../context/TelegramAuthContext';
import ChatWindow from '../components/ChatWindow';
import type { ChatPreview } from '../api/telegramChats';

const ChatPage: React.FC = () => {
  // Read :peerType and :peerId from route
  const { peerType, peerId } = useParams<{ peerType: 'user'|'chat'|'channel', peerId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { sessionId } = useTelegramAuth();

  // Allow opening chat directly via URL (no state). Build minimal preview.
  const chatFromState: ChatPreview | undefined = (state as any)?.chat;
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

  if (!sessionId || !peerType || !peerId) {
    navigate('/inbox', { replace: true });
    return null;
  }

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
