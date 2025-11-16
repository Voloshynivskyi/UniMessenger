// frontend/src/pages/inbox/InboxChatItem.tsx
import React from "react";
import { Box, ListItemButton, Typography, Avatar } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import type { UnifiedChat } from "../../types/unifiedChat.types";
import { TypingIndicator } from "../../components/common/TypingIndicator";
import { getSenderLabel } from "./utils/chatUtils";
import { formatTimeLabel, formatTypingLabel } from "./utils/chatUtils";

const InboxChatItem: React.FC<{
  chat: UnifiedChat;
  isSelected: boolean;
  onClick: () => void;
}> = ({ chat, isSelected, onClick }) => {
  const { typingByChat } = useUnifiedDialogs();

  const chatKey = `${chat.platform}:${chat.accountId}:${chat.chatId}`;
  const typing = typingByChat[chatKey];

  const last = chat.lastMessage;
  const unread = chat.unreadCount ?? 0;

  const timeLabel = last ? formatTimeLabel(last.date) : "";

  const sender = getSenderLabel(chat);
  const preview = chat.lastMessage?.text ?? "";

  const typingText = formatTypingLabel(chat, typing);

  // What to show as subtitle
  const subtitle = typingText
    ? typingText
    : sender
    ? `${sender}: ${preview}`
    : preview;

  return (
    <ListItemButton
      onClick={onClick}
      selected={isSelected}
      sx={{
        mb: 0.5,
        borderRadius: 1,
        py: 1.1,
        pr: 1.5,
        "&.Mui-selected": {
          bgcolor: "primary.light",
          "&:hover": { bgcolor: "primary.light" },
        },
        "&:hover": { bgcolor: "action.hover" },
        transition: "background-color 0.18s ease",
      }}
    >
      <Box sx={{ display: "flex", width: "100%" }}>
        {/* Avatar */}
        <Avatar
          sx={{
            width: 42,
            height: 42,
            mr: 1.5,
            bgcolor: "primary.main",
            color: "white",
            fontWeight: 600,
            fontSize: "1rem",
          }}
          src={chat.photo || undefined}
        >
          {chat.title?.[0] || "?"}
        </Avatar>

        {/* Middle column */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Chat title */}
          <Typography
            variant="subtitle2"
            noWrap
            sx={{
              fontWeight: 600,
              mb: 0.2,
              fontSize: "0.92rem",
            }}
          >
            {chat.title}
          </Typography>

          {/* Preview OR typing */}
          <Typography
            variant="caption"
            noWrap
            sx={{
              color: typingText ? "primary.main" : "text.secondary",
              fontWeight: typingText ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "70%",
              pr: 1,
              fontSize: "0.78rem",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            {typingText ? (
              <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                <Box
                  component="span"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flexShrink: 1,
                    minWidth: 0,
                    mr: 0.5,
                  }}
                >
                  {typingText}
                </Box>
                <TypingIndicator />
              </Box>
            ) : (
              subtitle
            )}
          </Typography>
        </Box>

        {/* Right column */}
        <Box
          sx={{
            ml: 1,
            minWidth: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {/* Time */}
          <Typography
            variant="caption"
            sx={{
              color: unread > 0 ? "primary.main" : "text.secondary",
              fontWeight: unread > 0 ? 700 : 400,
              mb: 0.4,
              fontSize: "0.75rem",
            }}
          >
            {timeLabel}
          </Typography>

          {/* Unread dot / pinned */}
          {unread > 0 ? (
            <Box
              sx={{
                backgroundColor: "#3A95E6",
                color: "white",
                minWidth: 22,
                height: 22,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {unread > 99 ? "99+" : unread}
            </Box>
          ) : chat.pinned ? (
            <PushPinIcon
              sx={{
                transform: "rotate(-45deg)",
                fontSize: 18,
                color: "text.secondary",
                opacity: 0.8,
              }}
            />
          ) : (
            <Box sx={{ width: 22, height: 22 }} />
          )}
        </Box>
      </Box>
    </ListItemButton>
  );
};

export default InboxChatItem;
