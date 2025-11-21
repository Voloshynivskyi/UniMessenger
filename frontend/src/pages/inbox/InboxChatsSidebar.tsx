// frontend/src/pages/inbox/InboxChatsSidebar.tsx
import React from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTelegram } from "../../context/TelegramAccountContext";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import InboxAccountSection from "./InboxAccountSection";

interface Props {
  width: number;
}

const InboxChatsSidebar: React.FC<Props> = ({ width }) => {
  const { accounts } = useTelegram();
  const { chatsByAccount, selectedChatKey, selectChat } = useUnifiedDialogs();

  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  // Height aligned with InboxPage container
  const containerHeight = `calc(100vh - 64px - ${isMdUp ? 48 : 32}px)`; // header + paddings

  return (
    <Box
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        height: "100%",
        minHeight: 0,
        flexShrink: 0,
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!accounts || accounts.length === 0 ? (
        <Typography variant="body2" sx={{ p: 2, color: "text.secondary" }}>
          No accounts connected. Please add an account to view chats.
        </Typography>
      ) : (
        accounts.map((acc) => {
          const chats = Object.values(chatsByAccount[acc.accountId] || {});
          return (
            <InboxAccountSection
              key={acc.accountId}
              account={acc}
              chats={chats}
              selectedChatKey={selectedChatKey}
              onSelectChat={selectChat}
            />
          );
        })
      )}
    </Box>
  );
};

export default InboxChatsSidebar;
