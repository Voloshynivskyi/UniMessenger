// frontend/src/pages/inbox/chat/MessageRow.tsx
import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";

import MessageBubble from "./TelegramMessageBubble";
import MediaRenderer from "./TelegramMediaRenderer";
import ServiceMessage from "./TelegramServiceMessage";

import type { UnifiedTelegramMessage } from "../../../../types/telegram.types";

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
   Grouping logic
--------------------------------------------------------- */
function isSameSender(
  prev?: UnifiedTelegramMessage | null,
  curr?: UnifiedTelegramMessage | null
) {
  if (!prev || !curr) return false;
  if (prev.from?.id !== curr.from?.id) return false;

  const t1 = new Date(prev.date).getTime();
  const t2 = new Date(curr.date).getTime();

  return Math.abs(t2 - t1) < 5 * 60 * 1000; // 5 minutes
}

function shouldShowHeader(
  prev: UnifiedTelegramMessage | null | undefined,
  curr: UnifiedTelegramMessage,
  isSelf: boolean,
  peerType?: "user" | "chat" | "channel"
) {
  if (isSelf) return false;

  const isGroupLike = peerType === "chat" || peerType === "channel";

  if (!isGroupLike) return false;
  if (!curr.from) return false;

  if (!prev) return true;

  return !isSameSender(prev, curr);
}

/* ---------------------------------------------------------
   MAIN
--------------------------------------------------------- */
function TelegramMessageRowBase({ message, isSelf, prevMessage, peerType }: Props) {
  const isService = message.type === "service";

  const hasMedia = !!message.media;
  const hasText = !!message.text?.trim();

  const isPureMedia =
    hasMedia && PURE_MEDIA_TYPES.includes(message.type) && !hasText;

  const content = useMemo(() => {
    if (isService) {
      return <ServiceMessage text={message.text || ""} />;
    }

    if (isPureMedia) {
      return <MediaRenderer message={message} />;
    }

    return <MessageBubble message={message} isSelf={isSelf} />;
  }, [isService, isPureMedia, message, isSelf]);

  const isGroupLike = peerType === "chat" || peerType === "channel";

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
      {/* MAIN COLUMN */}
      <Box
        sx={{
          maxWidth: "75%",
          display: "flex",
          flexDirection: "column",
          alignItems: isSelf ? "flex-end" : "flex-start",
        }}
      >
        {/* Header name */}
        {!isSelf && isGroupLike && showHeader && (
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

/* ---------------------------------------------------------
   React.memo optimization
--------------------------------------------------------- */
export default React.memo(TelegramMessageRowBase, (prev, next) => {
  return (
    prev.message.messageId === next.message.messageId &&
    prev.message.date === next.message.date &&
    prev.message.text === next.message.text &&
    prev.message.type === next.message.type &&
    prev.isSelf === next.isSelf &&
    prev.peerType === next.peerType
  );
});
