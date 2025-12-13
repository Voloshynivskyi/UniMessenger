// frontend/src/pages/inbox/chat/discord/DiscordMessageBubble.tsx

import { Box, Typography } from "@mui/material";
import type { UnifiedDiscordMessage } from "../../../../types/discord.types";
import DiscordMediaRenderer from "./DiscordMediaRenderer";

export default function DiscordMessageBubble({
  message,
}: {
  message: UnifiedDiscordMessage;
}) {
  const hasText = !!message.text?.trim();
  const media = message.media ?? null;
  const embeds = message.embeds ?? null;

  return (
    <Box
      sx={{
        maxWidth: "100%",
        px: 1.25,
        py: 0.9,
        borderRadius: 1.5,
        bgcolor: "#ffffff", // 🔥 БІЛИЙ CARD
        color: "#2e3338", // 🔥 ЧОРНИЙ ТЕКСТ
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        transition: "background 0.12s ease",
        "&:hover": {
          bgcolor: "#f2f3f5", // Discord hover
        },
      }}
    >
      {/* MEDIA */}
      {!!media?.length && (
        <Box sx={{ mb: hasText ? 0.8 : 0 }}>
          <DiscordMediaRenderer message={message} />
        </Box>
      )}

      {/* TEXT */}
      {hasText && (
        <Typography
          sx={{
            fontSize: 14,
            lineHeight: 1.45,
            color: "#2e3338",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.text}
        </Typography>
      )}

      {/* EMBEDS */}
      {!!embeds?.length && (
        <Box
          sx={{ mt: 0.8, display: "flex", flexDirection: "column", gap: 0.8 }}
        >
          {embeds.map((e, idx) => {
            if (!e.url) return null;

            return (
              <Box
                key={`${e.url}-${idx}`}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: "#f6f6f7",
                  border: "1px solid #e3e5e8",
                }}
              >
                <Box
                  component="a"
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: "#0066cc",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "block",
                    maxWidth: 360,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {e.title ?? e.url}
                </Box>

                {e.description && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: "#4f5660",
                      mt: 0.3,
                    }}
                  >
                    {e.description}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
