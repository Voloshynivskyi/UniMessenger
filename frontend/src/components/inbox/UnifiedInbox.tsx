// frontend/src/components/inbox/UnifiedInbox.tsx
import { Card, Box, Typography } from "@mui/material";
import React from "react";
import UserChatList from "./UserChatList";
import { useTelegramDialogs } from "./hooks/useTelegramDialogs";
import type { TelegramAuthAccount } from "../../api/telegramApi";
interface UnifiedInboxProps {
  accounts: TelegramAuthAccount[];
}

const UnifiedInbox: React.FC<UnifiedInboxProps> = ({ accounts }) => {
  const { data, loadMore } = useTelegramDialogs(accounts);
  const userChatLists = data.map((user) => (
    <UserChatList key={user.accountId} data={user} />
  ));
  return (
    <Card sx={{ p: 4, maxWidth: "100%", mx: "auto", borderRadius: 4 }}>
      <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0" }}>
        <Typography variant="h6">Unified Inbox</Typography>
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>{userChatLists}</Box>
    </Card>
  );
};

export default UnifiedInbox;
