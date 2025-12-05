// frontend/src/pages/inbox/chat/MessageBubble.tsx
import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import MediaRenderer from "./MediaRenderer";
import MessageTimestamp from "./MessageTimestamp";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

/**
 * Парсинг тексту з лінками (чиста функція).
 */
function parseLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, idx) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "inherit",
            textDecoration: "underline",
            wordBreak: "break-word",
          }}
        >
          {part}
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function MessageBubbleBase({ message, isSelf }: Props) {
  const hasMedia = !!message.media && message.type !== "text";
  const hasText = !!message.text?.trim();

  const outgoingBg = "#cde8ff";
  const incomingBg = "#ffffff";

  const bubbleRadius = isSelf ? "18px 18px 4px 18px" : "18px 18px 18px 4px";

  // Мемоізація тексту з лінками
  const renderedText = useMemo(() => {
    if (!message.text) return null;
    return parseLinks(message.text);
  }, [message.text]);

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: bubbleRadius,
        bgcolor: isSelf ? outgoingBg : incomingBg,
        color: "#0f1419",
        maxWidth: "100%",
        boxShadow: "0 1px 1px rgba(0,0,0,0.15)",
      }}
    >
      {hasMedia && (
        <Box sx={{ mb: hasText ? 1 : 0 }}>
          {/* showTimestampOverlay=false → щоб не було дубля таймстемпу поверх медіа */}
          <MediaRenderer message={message} showTimestampOverlay={false} />
        </Box>
      )}

      {hasText && (
        <Typography
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 14,
            lineHeight: 1.35,
          }}
        >
          {renderedText}
        </Typography>
      )}

      {/* Таймстемп ТІЛЬКИ коли є текст (text або text+media) */}
      {hasText && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mt: 0.25,
          }}
        >
          <MessageTimestamp date={message.date} />
        </Box>
      )}
    </Box>
  );
}

/**
 * React.memo — бульбашка не перерендерюється,
 * якщо не змінилися ключові поля.
 */
export default React.memo(MessageBubbleBase, (prev, next) => {
  return (
    prev.message.messageId === next.message.messageId &&
    prev.message.date === next.message.date &&
    prev.message.text === next.message.text &&
    prev.message.type === next.message.type &&
    prev.isSelf === next.isSelf
  );
});
