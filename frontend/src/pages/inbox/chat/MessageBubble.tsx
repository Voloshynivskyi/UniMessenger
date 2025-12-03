// frontend/src/pages/inbox/chat/MessageBubble.tsx
import { Box, Typography } from "@mui/material";
import MediaRenderer from "./MediaRenderer";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

function renderTextWithLinks(text: string) {
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

export default function MessageBubble({ message, isSelf }: Props) {
  const hasMedia = !!message.media && message.type !== "text";
  const hasText = !!message.text?.trim();

  const outgoingBg = "#cde8ff";
  const incomingBg = "#ffffff";

  const bubbleRadius = isSelf
    ? "18px 18px 4px 18px"
    : "18px 18px 18px 4px";

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
          <MediaRenderer message={message} />
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
          {renderTextWithLinks(message.text!)}
        </Typography>
      )}
    </Box>
  );
}
