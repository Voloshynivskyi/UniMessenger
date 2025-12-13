// frontend/src/pages/inbox/chat/discord/DiscordMessageRow.tsx

import { Box, Typography } from "@mui/material";
import type { UnifiedDiscordMessage } from "../../../../types/discord.types";
import DiscordMessageBubble from "./DiscordMessageBubble";

interface Props {
  message: UnifiedDiscordMessage;
  prevMessage?: UnifiedDiscordMessage | null;
}

export default function DiscordMessageRow({ message, prevMessage }: Props) {
  const showAuthor =
    !prevMessage ||
    prevMessage.senderId !== message.senderId ||
    Math.abs(
      new Date(message.date).getTime() - new Date(prevMessage.date).getTime()
    ) >
      5 * 60 * 1000;

  const timeLabel = (() => {
    const d = new Date(message.date);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  })();

  return (
    <Box
      sx={{
        px: 2,
        py: showAuthor ? 1.4 : 0.4,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showAuthor && (
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            mb: 0.4,
          }}
        >
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 600,
              color: "#3b5bfd", // Discord-like blue
            }}
          >
            {message.from.name}
          </Typography>

          <Typography
            sx={{
              fontSize: 12,
              color: "#8e9297",
              userSelect: "none",
            }}
          >
            {timeLabel}
          </Typography>
        </Box>
      )}

      <DiscordMessageBubble message={message} />
    </Box>
  );
}
