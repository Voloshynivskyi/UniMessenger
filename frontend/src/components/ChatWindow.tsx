// File: frontend/src/components/ChatWindow.tsx
// Purpose: Chat view with scrollable list + composer + infinite scroll.
// - Optimistic local message gets replaced by real one (WS or POST response).
// - Robust fetch (array or {messages: []}), WS append, auto-scroll.
// - Infinite scroll: load older messages on reaching top (beforeId pagination).
// - Enter to send, Shift+Enter for newline.

import React from "react";
import { MessageList } from "./chat/MessageList";
import { Composer } from "./chat/Composer";
import { useParams } from "react-router-dom";
import type { Params } from "../types/chat";
import { useResolvedSessionId } from "../hooks/useResolvedSessionId";
import { useChatFeed } from "../hooks/useChatFeed";
import { useChatSenders } from "../hooks/useChatSenders";

const ChatWindow: React.FC = () => {
  const { peerType = "", peerId = "" } = useParams<Params>();
  const peerKey = React.useMemo(
    () => `${peerType}:${peerId}`,
    [peerType, peerId]
  );
  const sessionId = useResolvedSessionId();

  const {
    listRef,
    messages,
    setMessages,
    loading,
    error,
    setError,
    hasMore,
    loadingOlder,
    onListScroll,
    replaceOptimisticWithReal,
    outboxMapRef,
  } = useChatFeed(sessionId, peerKey);

  const {
    text,
    setText,
    sending,
    uploading,
    fileInputRef,
    onKeyDown,
    onAttachClick,
    onFileSelected,
    doSend,
  } = useChatSenders({
    sessionId,
    peerKey,
    listRef,
    setMessages,
    setError,
    replaceOptimisticWithReal,
    outboxMapRef,
  });

  if (!sessionId) {
    return (
      <div className="p-4 text-sm text-red-600">
        SessionId not found. Open chat via Unified Inbox or add
        ?s=&lt;sessionId&gt; to the URL.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList
        listRef={listRef}
        messages={messages}
        loading={loading}
        error={error}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onScroll={onListScroll}
      />
      <Composer
        text={text}
        setText={setText}
        sending={sending}
        uploading={uploading}
        onKeyDown={onKeyDown}
        onSendClick={() => {
          const v = text;
          setText("");
          void doSend(v);
        }}
        onAttachClick={onAttachClick}
        fileInputRef={fileInputRef}
        onFileSelected={onFileSelected}
      />
    </div>
  );
};

export default ChatWindow;
