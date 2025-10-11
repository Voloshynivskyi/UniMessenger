// File: frontend/src/components/chat/Composer.tsx
// Input area with hidden file input, attach button and send button.

import React from "react";

type Props = {
  text: string;
  setText: (v: string) => void;
  sending: boolean;
  uploading: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendClick: () => void;
  onAttachClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const Composer: React.FC<Props> = ({
  text,
  setText,
  sending,
  uploading,
  onKeyDown,
  onSendClick,
  onAttachClick,
  fileInputRef,
  onFileSelected,
}) => {
  const canSend = text.trim().length > 0 && !sending && !uploading;

  return (
    <div className="border-t bg-white p-3">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={onFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={onAttachClick}
          disabled={uploading}
          title={uploading ? "Uploading…" : "Attach file"}
          className={`px-3 py-2 rounded-lg border ${
            uploading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-white hover:bg-gray-50"
          }`}
        >
          📎
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-blue-200"
          rows={1}
        />

        <button
          disabled={!canSend}
          onClick={onSendClick}
          className={`px-4 py-2 rounded-lg ${
            !canSend
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Send
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Enter — send, Shift+Enter — new line
      </div>
    </div>
  );
};
