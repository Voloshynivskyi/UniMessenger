import React from "react";
import { Box, TextField, Alert } from "@mui/material";
import StepHeader from "../../_shared/StepHeader";
import StepContainer from "../../_shared/StepContainer";

interface Props {
  phone: string;
  error?: string | null;
  onChange: (v: string) => void;
}

const PhoneStepContent: React.FC<Props> = ({ phone, error, onChange }) => {
  return (
    <StepContainer>
      <StepHeader
        title="Enter your phone number"
        subtitle="We will send you a Telegram verification code"
      />

      <TextField
        label="Phone number"
        fullWidth
        value={phone}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+480XXXXXXXXX"
      />

      {error && <Alert severity="error">{error}</Alert>}
    </StepContainer>
  );
};

export default PhoneStepContent;
