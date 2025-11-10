import List from "@mui/material/List";
import React from "react";
import { AccountListItem } from "./AccountListItem";
import type { TelegramAuthAccount } from "../../api/telegramApi";
import NoAccountsPlaceholder from "./NoAccountsPlaceholder";
import AccountAddListItem from "./AccountAddListItem";
import { useTelegram } from "../../context/TelegramAccountContext";
/**
 * Props for AccountList component.
 */

interface AccountListProps {
  accounts: TelegramAuthAccount[];
  OnAddButtonClick(): void;
}

/**
 * Component for displaying a list of connected messaging accounts
 */
const AccountList: React.FC<AccountListProps> = ({
  accounts,
  OnAddButtonClick,
}) => {
  if (!accounts || accounts.length === 0) {
    return <NoAccountsPlaceholder onAddClick={OnAddButtonClick} />;
  }
  const { logoutAccount, refreshAccounts } = useTelegram();
  const accs = accounts.map((account) => (
    <AccountListItem
      key={account.telegramId.toString()}
      account={account}
      onLogoutClick={logoutAccount}
      refresh={refreshAccounts}
    />
  ));
  accs.push(
    <AccountAddListItem key={"add-account"} onClick={OnAddButtonClick} />
  );
  return <List>{accs}</List>;
};

export default AccountList;
