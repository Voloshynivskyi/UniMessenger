// frontend/src/pages/accounts/telegram/steps/PasswordStepContent.tsx
import React from "react";
import { TextField, Alert, Typography } from "@mui/material";
import StepHeader from "../../_shared/StepHeader";
export interface PasswordStepProps {
  password: string;
  setPassword: (v: string) => void;

  error?: string;
  loading: boolean;
}

const PasswordStepContent: React.FC<PasswordStepProps> = ({
  password,
  setPassword,
  error,
}) => {
  return (
    <>
      <StepHeader title="Enter your Telegram 2FA password" />

      <TextField
        type="password"
        label="Password"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </>
  );
};
export default PasswordStepContent;
