import React, { useState } from "react";
import { Box } from "@mui/material";
import AccountMenu from "../components/accounts/AccountsMenu";

const AccountsPage: React.FC = () => {
  return (
    <Box>
      <AccountMenu />
    </Box>
  );
};

export default AccountsPage;
