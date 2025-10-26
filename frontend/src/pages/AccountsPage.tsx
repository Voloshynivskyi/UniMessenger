import React, { useState } from "react";
import { Box } from "@mui/material";
import AccountMenu from "../components/accounts/AccountsMenu";

const AccountsPage: React.FC = () => {
  return (
    <Box sx={{ p: 4 }}>
      <AccountMenu />
    </Box>
  );
};

export default AccountsPage;
