import { Box, Typography } from "@mui/material";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
}

export default function MessageBubble({ message, isSelf }: Props) {
  const dateObj = new Date(message.date as any);
  const valid = !isNaN(dateObj.getTime());

  const bubbleBg = isSelf ? "primary.main" : "background.paper";
  const bubbleColor = isSelf ? "primary.contrastText" : "text.primary";

  const timeText = valid
    ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

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
          transition: "transform 120ms ease, box-shadow 120ms ease",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: (t) => `0 4px 14px ${t.palette.action.hover}`,
          },
        }}
      >
        {/* TEXT */}
        {message.type === "text" && (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.45,
            }}
          >
            {message.text}
          </Typography>
        )}

        {/* PHOTO */}
        {message.type === "photo" && message.media?.photo && (
          <Box>
            <Box
              component="img"
              src={`/api/telegram/photo/${message.media.photo.id}`}
              alt="photo"
              sx={{
                display: "block",
                maxWidth: "100%",
                borderRadius: 2,
              }}
            />
            {message.text && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {message.text}
              </Typography>
            )}
          </Box>
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
