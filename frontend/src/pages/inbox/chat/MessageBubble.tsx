// frontend/src/pages/inbox/chat/MessageBubble.tsx
import { Box, Typography } from "@mui/material";
import MediaRenderer from "./MediaRenderer";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

export default function MessageBubble({ message, isSelf }: Props) {
  const hasMedia = !!message.media && message.type !== "text";
  const hasText = !!message.text?.trim();

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 3,
        bgcolor: isSelf ? "primary.main" : "background.paper",
        color: isSelf ? "primary.contrastText" : "text.primary",
        boxShadow: 1,
      }}
    >
      {hasMedia && <MediaRenderer message={message} />}

      {hasText && (
        <Typography
          variant="body2"
          sx={{
            mt: hasMedia ? 1 : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.text}
        </Typography>
      )}
    </Box>
  );
}
