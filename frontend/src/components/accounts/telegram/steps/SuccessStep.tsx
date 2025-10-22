/**
 * frontend/src/components/accounts/telegram/steps/SuccessStep.tsx
 * Final step of Telegram authentication - success confirmation display
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";

interface SuccessStepProps {
  accountInfo: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

const SuccessStep: React.FC<SuccessStepProps> = ({ accountInfo }) => {
  return (
    <Box sx={{ textAlign: "center" }}>
      <DoneIcon sx={{ fontSize: 60, color: "green", mb: 2 }} />
      <Typography variant="h6">
        Account{" "}
        {accountInfo?.username ||
          accountInfo?.firstName + " " + accountInfo?.lastName ||
          accountInfo?.phone}{" "}
        Added Successfully!
      </Typography>
    </Box>
  );
};

export default SuccessStep;
