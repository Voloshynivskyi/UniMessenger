// frontend/src/pages/accounts/AccountList.tsx
import React from "react";
import List from "@mui/material/List";
import { AccountListItem } from "./AccountListItem";
import type { TelegramAuthAccount } from "../../api/telegramApi";
import NoAccountsPlaceholder from "./NoAccountsPlaceholder";
import AccountAddListItem from "./AccountAddListItem";

interface AccountListProps {
  accounts: TelegramAuthAccount[];
  onAddClick: () => void;
  onLogoutAccount: (accountId: string) => void;
  onRefreshAccounts: () => void;
}

/**
 * Pure UI component for displaying a list of connected accounts.
 * No context, no business logic — everything comes via props.
 */
const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onAddClick,
  onLogoutAccount,
  onRefreshAccounts,
}) => {
  // if no accounts, show placeholder
  if (!accounts || accounts.length === 0) {
    return <NoAccountsPlaceholder onAddClick={onAddClick} />;
  }

  return (
    <List disablePadding>
      {accounts.map((account) => (
        <AccountListItem
          key={account.telegramId.toString()}
          account={account}
          onLogoutClick={onLogoutAccount}
          refresh={onRefreshAccounts}
        />
      ))}

      <AccountAddListItem key="add-account" onClick={onAddClick} />
    </List>
  );
};

export default AccountList;
