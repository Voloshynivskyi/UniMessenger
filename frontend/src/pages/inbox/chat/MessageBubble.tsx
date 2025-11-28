import { Box, Typography } from "@mui/material";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

export default function MessageBubble({ message, isSelf }: Props) {
  const dateObj = new Date(message.date as any);
  const timeText = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const bubbleBg = isSelf ? "primary.main" : "background.paper";
  const bubbleColor = isSelf ? "primary.contrastText" : "text.primary";

  const media = message.media;
  const mediaUrl =
    media && message.accountId
      ? `/media/telegram/${message.accountId}/${media.id}`
      : null;

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
          bgcolor: bubbleBg,
          color: bubbleColor,
          boxShadow: (t) => `0 2px 10px ${t.palette.action.hover}`,
          position: "relative",
          pr: 6,
        }}
      >
        {/* ----- TEXT ----- */}
        {message.type === "text" && (
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
            {message.text}
          </Typography>
        )}

        {/* ----- PHOTO ----- */}
        {message.type === "photo" && mediaUrl && (
          <Box>
            <Box
              component="img"
              src={mediaUrl}
              alt="photo"
              sx={{
                display: "block",
                maxWidth: "100%",
                borderRadius: 2,
              }}
            />
            {message.text && (
              <Typography sx={{ mt: 0.75, whiteSpace: "pre-wrap" }}>
                {message.text}
              </Typography>
            )}
          </Box>
        )}

        {/* ----- VIDEO ----- */}
        {message.type === "video" && mediaUrl && (
          <video
            src={mediaUrl}
            controls
            style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "4px" }}
          />
        )}

        {/* ----- DOCUMENT / FILE ----- */}
        {message.type === "file" && mediaUrl && (
          <a
            href={mediaUrl}
            download={message.media?.fileName ?? "file"}
            style={{ color: bubbleColor }}
          >
            📎 {message.media?.fileName ?? "Download file"}
          </a>
        )}

        {/* ----- AUDIO ----- */}
        {(message.type === "voice" || message.type === "audio") && mediaUrl && (
          <audio controls src={mediaUrl} style={{ width: "100%" }} />
        )}

        {/* ----- STICKER ----- */}
        {message.type === "sticker" && mediaUrl && (
          <img
            src={mediaUrl}
            alt="sticker"
            style={{
              maxWidth: "180px",
              maxHeight: "180px",
              display: "block",
            }}
          />
        )}

        {/* TIME */}
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            bottom: 4,
            right: 8,
            opacity: 0.75,
            fontSize: 10.5,
          }}
        >
          {timeText}
        </Typography>
      </Box>
    </Box>
  );
}
