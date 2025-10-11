// File: frontend/src/components/chat/MessageBubble.tsx
// Renders a single message bubble.

import React from "react";
import type { Msg } from "../../types/chat";
import { timeLabelOf } from "../../types/chat";

export const MessageBubble: React.FC<{ msg: Msg }> = ({ msg }) => {
  const isOut = !!msg.out;
  const content =
    msg.text && msg.text.trim().length
      ? msg.text
      : msg.service
      ? "[service]"
      : "[без тексту]";
  const title = timeLabelOf(msg.date);

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] p-2 rounded-lg shadow text-sm whitespace-pre-wrap break-words ${
          isOut ? "bg-blue-600 text-white" : "bg-white"
        }`}
        title={title}
      >
        {content}
      </div>
    </div>
  );
};
