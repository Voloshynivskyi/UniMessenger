// frontend/src/pages/inbox/InboxChatsSidebar.tsx
import React, { useEffect } from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTelegram } from "../../context/TelegramAccountContext";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import InboxAccountSection from "./InboxAccountSection";
import InboxDiscordSection from "./InboxDiscordSection";
import { useCallback } from "react";

interface Props {
  width: number;
}

const InboxChatsSidebar: React.FC<Props> = ({ width }) => {
  const { accounts } = useTelegram();
  const {
    chatsByAccount,
    selectedChatKey,
    selectChat,
    discordDialogsByBot,
    fetchDiscordDialogs,
  } = useUnifiedDialogs();

  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

  useEffect(() => {
    fetchDiscordDialogs();
  }, [fetchDiscordDialogs]);

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
      {/* TELEGRAM */}
      {!accounts || accounts.length === 0 ? (
        <Typography sx={{ p: 2, color: "text.secondary" }}>
          No accounts connected.
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

      {/* DISCORD */}
      {Object.values(discordDialogsByBot).length > 0 && (
        <>
          <Typography
            sx={{
              px: 2,
              pt: 2,
              pb: 0.5,
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.6,
            }}
          >
            DISCORD
          </Typography>

          {Object.values(discordDialogsByBot).map((bot) => (
            <InboxDiscordSection
              key={bot.botId}
              bot={bot}
              selectedChatKey={selectedChatKey}
              onSelectChat={selectChat}
            />
          ))}
        </>
      )}
    </Box>
  );
};

export default InboxChatsSidebar;
