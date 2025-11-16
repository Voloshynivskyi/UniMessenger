import React from "react";
import { Box, ListItemButton, Typography, Avatar } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import type { UnifiedChat } from "../../types/unifiedChat.types";

import { getSenderLabel } from "./utils/chatUtils";

/* -------------------- TIME FORMAT -------------------- */
const formatTimeLabel = (dateStr?: string): string => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const dayIndex = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  if (date >= start && date <= end) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

/* -------------------- TYPING FORMAT -------------------- */
const formatTypingLabel = (
  chat: UnifiedChat,
  typing?: { users: string[] }
): string | null => {
  if (!typing || typing.users.length === 0) return null;

  // Channels don't type
  if (chat.peerType === "channel") return null;

  // Private chat → simple
  if (chat.peerType === "user") {
    return "typing…";
  }

  // Group chat
  if (typing.users.length === 1) {
    return `${typing.users[0]} is typing…`;
  }

  if (typing.users.length === 2) {
    return `${typing.users[0]}, ${typing.users[1]} are typing…`;
  }

  return `${typing.users[0]}, ${typing.users[1]}… are typing…`;
};

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
              maxWidth: "100%",
              pr: 1,
              fontSize: "0.78rem",
            }}
          >
            {subtitle}
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
