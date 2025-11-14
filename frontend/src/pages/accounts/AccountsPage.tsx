// frontend/src/pages/accounts/AccountsPage.tsx
// Application page for managing connected accounts
import React, { useEffect, useState } from "react";
import { Typography, Divider } from "@mui/material";

import PageContainer from "../../components/common/PageContainer";
import SectionCard from "../../components/common/SectionCard";
import AccountList from "./AccountList";
import { useTelegram } from "../../context/TelegramAccountContext";

import TelegramAuthFlow from "../accounts/telegram/TelegramAuthFlow";
import type { TelegramAuthAccount } from "../../api/telegramApi";

const AccountsPage: React.FC = () => {
  const { accounts, refreshAccounts, logoutAccount } = useTelegram();

  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    refreshAccounts();
  }, []);

  return (
    <PageContainer>
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Connected Telegram Accounts
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <AccountList
          accounts={accounts as TelegramAuthAccount[]}
          onAddClick={() => setIsAuthOpen(true)}
          onLogoutAccount={logoutAccount}
          onRefreshAccounts={refreshAccounts}
        />
      </SectionCard>

      <TelegramAuthFlow
        open={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onComplete={refreshAccounts}
      />
    </PageContainer>
  );
};

export default AccountsPage;
