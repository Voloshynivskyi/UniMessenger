/**
 * frontend/src/pages/InboxPage.tsx
 * Unified inbox page displaying messages from all connected accounts
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTelegram } from "../context/TelegramContext";
import UnifiedInbox from "../components/inbox/UnifiedInbox";
const InboxPage: React.FC = () => {
  const { accounts } = useTelegram();
  return (
    <Box>
      <UnifiedInbox accounts={accounts || []} />
    </Box>
  );
};

export default InboxPage;
