/**
 * frontend/src/components/accounts/AccountList.tsx
 * Component for displaying a list of connected messaging accounts
 */
import React from "react";
import { Card, Box, Typography, Divider } from "@mui/material";
import { useEffect } from "react";
import AccountList from "./AccountList";
import { useTelegram } from "../../context/TelegramContext";
import TelegramAuthModal from "./telegram/TelegramAuthModal";
import type { TelegramAuthAccount } from "../../api/telegramApi";

/**
 * Props for AccountMenu component.
 */

interface AccountMenuProps {}

/**
 * Component for managing and displaying connected messaging accounts
 */

const AccountMenu: React.FC<AccountMenuProps> = () => {
  const { accounts, loading, error, refreshAccounts, logoutAccount } =
    useTelegram();
  useEffect(() => {
    refreshAccounts();
    //console.log("Refreshing accounts...");
    // //console.log("Accounts from context:", accounts);
  }, []);

  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  return (
    <Card sx={{ p: 4, maxWidth: "100%", mx: "auto", borderRadius: 4 }}>
      <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
        Accounts Page
      </Typography>
      <Divider />
      <AccountList
        accounts={accounts as TelegramAuthAccount[]}
        OnAddButtonClick={() => setIsTelegramModalOpen(true)}
      />
      <TelegramAuthModal
        open={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onComplete={refreshAccounts}
      />
    </Card>
  );
};

export default AccountMenu;
