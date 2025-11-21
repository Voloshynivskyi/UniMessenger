// frontend/src/pages/inbox/InboxAccountSection.tsx
import React, { useState } from "react";
import { Box, Typography, Divider, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InboxChatItem from "./InboxChatItem";

import type { UnifiedChat } from "../../types/unifiedChat.types";
import type { TelegramAuthAccount } from "../../api/telegramApi";
import { buildChatKey } from "./utils/chatUtils";

interface Props {
  account: TelegramAuthAccount;
  chats: UnifiedChat[];
  selectedChatKey: string | null;
  onSelectChat: (key: string | null) => void;
}

const InboxAccountSection: React.FC<Props> = ({
  account,
  chats,
  selectedChatKey,
  onSelectChat,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Proper display name (same logic as AccountList)
  const displayName =
    account.username ||
    `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
    account.phoneNumber ||
    `ID: ${account.telegramId}`;

  return (
    <Box sx={{ px: 1.5, pt: 1.5 }}>
      {/* HEADER (clickable row) */}
      <Box
        onClick={() => setCollapsed((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          mb: collapsed ? 1 : 0.5,
          userSelect: "none",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ flex: 1, fontWeight: 600, color: "text.primary" }}
        >
          {displayName}
        </Typography>

        <IconButton
          size="small"
          sx={{
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

      {/* CHATS COLLAPSE AREA */}
      <Collapse
        in={!collapsed}
        timeout={250}
        easing={{
          enter: "cubic-bezier(0.4, 0, 0.2, 1)",
          exit: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        unmountOnExit
      >
        <Box>
          {chats.map((chat) => {
            const chatKey = buildChatKey(
              chat.platform,
              chat.accountId,
              chat.chatId
            );

            return (
              <InboxChatItem
                key={chatKey}
                chat={chat}
                isSelected={selectedChatKey === chatKey}
                onClick={() => onSelectChat(chatKey)}
              />
            );
          })}
        </Box>
      </Collapse>

      <Divider sx={{ mt: 1.5 }} />
    </Box>
  );
};

export default InboxAccountSection;
