import React from "react";
import { TextField, Alert } from "@mui/material";
import StepContainer from "../../_shared/StepContainer";
import StepHeader from "../../_shared/StepHeader";

interface Props {
  password: string;
  error?: string | null;
  onChange: (v: string) => void;
}

const PasswordStepContent: React.FC<Props> = ({
  password,
  onChange,
  error,
}) => {
  return (
    <StepContainer>
      <StepHeader
        title="Two-Factor Authentication"
        subtitle="Enter your Telegram password to continue"
      />

      <TextField
        type="password"
        label="Telegram password"
        fullWidth
        value={password}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your 2FA password"
      />

      {error && <Alert severity="error">{error}</Alert>}
    </StepContainer>
  );
};

export default PasswordStepContent;
