import { Box, Typography } from "@mui/material";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";
import MediaRenderer from "./MediaRenderer";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

export default function MessageBubble({ message, isSelf }: Props) {
  const dateObj = new Date(message.date as any);

  const fileUrl =
    message.type !== "text" && message.media
      ? `/api/telegram/media/${message.accountId}/${message.messageId}`
      : null;
  console.log("BUBBLE:", {
    id: message.messageId,
    type: message.type,
    media: message.media,
  });

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
      }}
    >
      <Box
        sx={{
          maxWidth: "68%",
          px: 1.75,
          py: 1.15,
          borderRadius: 2.5,
          bgcolor: isSelf ? "primary.main" : "background.paper",
          color: isSelf ? "primary.contrastText" : "text.primary",
          position: "relative",
          pr: 6,
        }}
      >
        {/* MEDIA */}
        {message.type !== "text" && message.media && (
          <MediaRenderer message={message} />
        )}

        {/* TEXT ONLY */}
        {message.type === "text" && (
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.text}
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{ position: "absolute", bottom: 4, right: 8, opacity: 0.75 }}
        >
          {dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Typography>
      </Box>
    </Box>
  );
}
