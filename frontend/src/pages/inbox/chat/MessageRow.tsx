// frontend/src/pages/inbox/chat/MessageRow.tsx
import { Box, Typography } from "@mui/material";
import MessageBubble from "./MessageBubble";
import MediaRenderer from "./MediaRenderer";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

export default function MessageRow({ message, isSelf }: Props) {
  const hasMedia = !!message.media && message.type !== "text";
  const hasText = !!message.text?.trim();
  const shouldUseBubble = !hasMedia || (hasMedia && hasText);

  const timeStr = new Date(message.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
        px: 2,
        py: 0.5,
      }}
    >
      <Box
        sx={{
          maxWidth: "75%",
          display: "flex",
          flexDirection: "column",
          alignItems: isSelf ? "flex-end" : "flex-start",
        }}
      >
        {/* Bubble or media */}
        {shouldUseBubble ? (
          <MessageBubble message={message} isSelf={isSelf} />
        ) : (
          <MediaRenderer message={message} />
        )}

        {/* Time */}
        <Typography
          variant="caption"
          sx={{
            mt: 0.25,
            opacity: 0.55,
            fontSize: "11px",
            pr: isSelf ? 0.4 : 0,
            pl: !isSelf ? 0.4 : 0,
          }}
        >
          {timeStr}
        </Typography>
      </Box>
    </Box>
  );
}
