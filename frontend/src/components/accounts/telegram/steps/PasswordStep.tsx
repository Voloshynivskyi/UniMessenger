/**
 * frontend/src/components/accounts/telegram/steps/PasswordStep.tsx
 * Third step of Telegram authentication - two-factor authentication password input
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert } from "@mui/material";
import apiClient from "../../../../api/apiClient";

interface PasswordStepProps {
  phoneNumber: string;
  phoneCodeHash: string;
  code: string;
  tempSession: string;
  onSuccess: (data: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => void;
}

const PasswordStep: React.FC<PasswordStepProps> = ({
  phoneNumber,
  phoneCodeHash,
  code,
  tempSession,
  onSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await apiClient.post("/api/telegram/2fa", {
        phoneNumber,
        phoneCode: code,
        phoneCodeHash: phoneCodeHash,
        password,
        tempSession,
      });
      if (
        response.data.status === "account_created" ||
        response.data.status === "session_replaced"
      ) {
        onSuccess(response.data);
      } else {
        setError("Unexpected response");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit password");
    }
  };

  return (
    <Box>
      <TextField
        type="password"
        label="Telegram Password"
        fullWidth
        sx={{ mb: 3 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" fullWidth onClick={handleSubmit}>
        Sign In
      </Button>
    </Box>
  );
};

export default PasswordStep;
