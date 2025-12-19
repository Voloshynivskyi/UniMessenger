import React from "react";
import {
  Box,
  ListItemButton,
  Typography,
  Avatar,
  Checkbox,
} from "@mui/material";
import type { UnifiedChat } from "../../../../types/unifiedChat.types";
import { useUnifiedDialogs } from "../../../../context/UnifiedDialogsContext";
import { TypingIndicator } from "../../../../components/common/TypingIndicator";
import {
  getSenderLabel,
  formatTimeLabel,
  formatTypingLabel,
} from "../../../inbox/utils/chatUtils";

interface Props {
  chat: UnifiedChat;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}
export default function SchedulerChatItem({
  chat,
  selected,
  onToggle,
  disabled,
}: Props) {
  const { typingByChat } = useUnifiedDialogs();

  const chatKey = `${chat.platform}:${chat.accountId}:${chat.chatId}`;
  const typing = typingByChat[chatKey];

  const last = chat.lastMessage;
  const timeLabel = last ? formatTimeLabel(last.date) : "";

  const sender = getSenderLabel(chat);
  const preview = last?.text ?? "";
  const typingText = formatTypingLabel(chat, typing);

  const subtitle = typingText
    ? typingText
    : sender
    ? `${sender}: ${preview}`
    : preview;

  return (
    <ListItemButton
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      selected={selected}
      sx={{
        py: 0.9,
        pr: 1,
        borderRadius: 1,
        maxWidth: "100%",
        overflow: "hidden",
        opacity: disabled ? 0.5 : 1,
        "&.Mui-selected": { bgcolor: "primary.light" },
        "&:hover": { bgcolor: disabled ? "inherit" : "action.hover" },
      }}
    >
      <Checkbox checked={selected} disabled={disabled} sx={{ mr: 1 }} />

      <Avatar
        sx={{
          width: 36,
          height: 36,
          mr: 1.2,
          bgcolor: "primary.main",
          flexShrink: 0,
        }}
      >
        {chat.title?.[0] || "?"}
      </Avatar>

      {/* TEXT */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          display: "grid",
          gridTemplateRows: "auto auto",
          overflow: "hidden",
        }}
      >
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.88rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {chat.title}
        </Typography>

        <Typography
          sx={{
            fontSize: "0.75rem",
            color: typingText ? "primary.main" : "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
            wordBreak: "break-all",
          }}
        >
          {subtitle}
        </Typography>
      </Box>

      <Typography
        sx={{
          ml: 1,
          fontSize: "0.7rem",
          color: "text.secondary",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {timeLabel}
      </Typography>
    </ListItemButton>
  );
}
