// File: frontend/src/components/chat/MessageList.tsx
// Scrollable list with top markers and loaders.

import React from "react";
import type { Msg } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

type Props = {
  listRef: React.RefObject<HTMLDivElement | null>;
  messages: Msg[];
  loading: boolean;
  error: string | null;
  loadingOlder: boolean;
  hasMore: boolean;
  onScroll: () => void;
};

export const MessageList: React.FC<Props> = ({
  listRef,
  messages,
  loading,
  error,
  loadingOlder,
  hasMore,
  onScroll,
}) => {
  return (
    <div
      ref={listRef}
      className="flex-1 overflow-auto p-4 space-y-2 bg-gray-50"
      onScroll={onScroll}
    >
      {!loadingOlder && !hasMore && messages.length > 0 && (
        <div className="text-center text-[11px] text-gray-400 mb-2">
          This is the beginning of history
        </div>
      )}

      {loadingOlder && (
        <div className="text-center text-xs text-gray-500 py-1">
          Loading history…
        </div>
      )}

      {loading && messages.length === 0 && (
        <div className="opacity-60 text-sm">Loading messages…</div>
      )}

      {error && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {error}
        </div>
      )}

      {messages.map((m) => (
        <MessageBubble key={String(m.id)} msg={m} />
      ))}

      {!loading && messages.length === 0 && !error && (
        <div className="opacity-60 text-sm">No messages</div>
      )}
    </div>
  );
};
