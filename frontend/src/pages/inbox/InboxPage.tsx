/**
 * frontend/src/pages/InboxPage.tsx
 * Unified inbox page displaying messages from all connected accounts
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTelegram } from "../../context/TelegramAccountContext";
import DialogDebugPage from "./DebugDialog";
import PageContainer from "../../components/common/PageContainer";
// import UnifiedInbox from "../components/inbox/UnifiedInbox";
const InboxPage: React.FC = () => {
  const { accounts } = useTelegram();
  return (
    <PageContainer>
      {/* <UnifiedInbox accounts={accounts || []} /> */}
      <DialogDebugPage />
    </PageContainer>
  );
};

export default InboxPage;
