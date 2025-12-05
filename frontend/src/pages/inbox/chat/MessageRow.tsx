// frontend/src/pages/inbox/chat/MessageRow.tsx
import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";

import MessageBubble from "./MessageBubble";
import MediaRenderer from "./MediaRenderer";
import ServiceMessage from "./ServiceMessage";

import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
  isSelf: boolean;
  prevMessage?: UnifiedTelegramMessage | null;
  peerType?: "user" | "chat" | "channel";
}

const PURE_MEDIA_TYPES: UnifiedTelegramMessage["type"][] = [
  "photo",
  "animation",
  "video",
  "video_note",
  "sticker",
];

/* ---------------------------------------------------------
   Check if two messages belong to the same "visual group"
--------------------------------------------------------- */
function isSameSender(
  prev?: UnifiedTelegramMessage | null,
  curr?: UnifiedTelegramMessage | null
) {
  if (!prev || !curr) return false;
  if (prev.from?.id !== curr.from?.id) return false;

  const t1 = new Date(prev.date).getTime();
  const t2 = new Date(curr.date).getTime();

  // Telegram-style grouping: within 5 minutes
  return Math.abs(t2 - t1) < 5 * 60 * 1000;
}

function shouldShowHeader(
  prev: UnifiedTelegramMessage | null | undefined,
  curr: UnifiedTelegramMessage,
  isSelf: boolean,
  peerType?: "user" | "chat" | "channel"
) {
  // no header for outgoing messages at all
  if (isSelf) return false;

  // no header in 1-1 chats and channels – only in groups
  const isGroupLike = peerType === "chat";
  if (!isGroupLike) return false;

  if (!curr.from) return false;
  if (!prev) return true;

  return !isSameSender(prev, curr);
}

/* ---------------------------------------------------------
   Helpers for avatar
--------------------------------------------------------- */
function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function tgColorForId(id: string) {
  const colors = [
    "#E17076",
    "#E0609A",
    "#D45AAB",
    "#A86EC5",
    "#6D81D5",
    "#5BA5E0",
    "#5BC8E7",
    "#49D3B4",
    "#4DD16E",
    "#A0C34E",
    "#F7CB4D",
    "#F79F4D",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

/* ---------------------------------------------------------
   MAIN COMPONENT
--------------------------------------------------------- */
function MessageRowBase({ message, isSelf, prevMessage, peerType }: Props) {
  const isService = message.type === "service";

  const hasMedia = !!message.media;
  const hasText = !!message.text?.trim();

  const isPureMedia =
    hasMedia &&
    PURE_MEDIA_TYPES.includes(message.type as UnifiedTelegramMessage["type"]) &&
    !hasText;

  const content = useMemo(() => {
    if (isService) {
      return <ServiceMessage text={message.text || ""} />;
    }

    if (isPureMedia) {
      // pure media – no bubble
      return <MediaRenderer message={message} />;
    }

    // text or text+media inside bubble
    return <MessageBubble message={message} isSelf={isSelf} />;
  }, [isService, isPureMedia, message, isSelf]);

  const showHeader = shouldShowHeader(prevMessage, message, isSelf, peerType);

  const senderName = message.from?.name || "";

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: isSelf ? "flex-end" : "flex-start",
        px: 2,
        py: 0.6,
      }}
      data-msg-id={message.messageId}
    >
      {/* LEFT SIDE: avatar only for incoming group messages */}
      {!isSelf && peerType === "chat" && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mr: 1,
          }}
        >
          {showHeader ? (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: tgColorForId(message.from?.id || "0"),
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              {getInitials(senderName)}
            </Box>
          ) : (
            // placeholder to keep horizontal alignment in message groups
            <Box sx={{ width: 36, height: 20 }} />
          )}
        </Box>
      )}

      {/* MAIN COLUMN: optional name + content */}
      <Box
        sx={{
          maxWidth: "75%",
          display: "flex",
          flexDirection: "column",
          alignItems: isSelf ? "flex-end" : "flex-start",
        }}
      >
        {/* Name above bubble – only for incoming group messages on first in group */}
        {!isSelf && peerType === "chat" && showHeader && (
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              mb: 0.3,
              color: "#5b6a75",
              ml: isSelf ? 0 : 0.4,
            }}
          >
            {senderName}
          </Typography>
        )}

        {content}
      </Box>
    </Box>
  );
}

/**
 * memo – re-render this row only when needed
 */
export default React.memo(MessageRowBase, (prev, next) => {
  return (
    prev.message.messageId === next.message.messageId &&
    prev.message.date === next.message.date &&
    prev.message.text === next.message.text &&
    prev.message.type === next.message.type &&
    prev.isSelf === next.isSelf &&
    prev.peerType === next.peerType
  );
});
