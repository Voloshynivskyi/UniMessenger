/**
 * frontend/src/components/accounts/telegram/steps/SuccessStep.tsx
 * Final step of Telegram authentication - success confirmation display
 */

import React from "react";
import { Box, Typography, Button } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import type { SignInSuccessResult } from "../../../../api/telegramAuth";

interface SuccessStepProps {
  accountInfo: SignInSuccessResult | null;
  onClose: () => void;
}

const SuccessStep: React.FC<SuccessStepProps> = ({ accountInfo, onClose }) => {
  return (
    <Box sx={{ textAlign: "center" }}>
      <DoneIcon sx={{ fontSize: 60, color: "green", mb: 2 }} />
      <Typography variant="h6">
        Account{" "}
        {accountInfo?.username ||
          `${accountInfo?.firstName ?? ""} ${accountInfo?.lastName ?? ""}` ||
          accountInfo?.phoneNumber}{" "}
        Added Successfully!
      </Typography>

      <Button sx={{ mt: 3 }} variant="contained" onClick={onClose} fullWidth>
        Close
      </Button>
    </Box>
  );
};
export default SuccessStep;
