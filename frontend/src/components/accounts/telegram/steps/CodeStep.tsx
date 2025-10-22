/**
 * frontend/src/components/accounts/telegram/steps/CodeStep.tsx
 * Second step of Telegram authentication - verification code input
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import apiClient from "../../../../api/apiClient";

interface CodeStepProps {
  phoneNumber: string;
  phoneCodeHash: string;
  tempSession: string;
  onPasswordRequired: (code: string) => void;
  onSuccess: (data: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => void;
}

const CodeStep: React.FC<CodeStepProps> = ({
  phoneNumber,
  phoneCodeHash,
  tempSession,
  onPasswordRequired,
  onSuccess,
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const handleSignIn = async () => {
    try {
      const response = await apiClient.post("/api/telegram/signIn", {
        phoneNumber,
        phoneCode: code,
        phoneCodeHash: phoneCodeHash,
        tempSession,
      });

      if (
        response.data.status === "account_created" ||
        response.data.status === "session_replaced"
      ) {
        onSuccess(response.data);
      } else if (response.data.status === "need_password") {
        onPasswordRequired(code);
      } else {
        setError("Unexpected server response");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to sign in");
    }
  };

  return (
    <Box>
      <TextField
        label="Verification Code"
        fullWidth
        sx={{ mb: 3 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" fullWidth onClick={handleSignIn}>
        Confirm <LoginIcon sx={{ ml: 1 }} />
      </Button>
    </Box>
  );
};

export default CodeStep;
