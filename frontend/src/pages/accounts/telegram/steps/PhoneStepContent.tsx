// frontend/src/pages/accounts/telegram/steps/PhoneStep.tsx
/**
 * Step component for entering phone number during Telegram authentication.
 */
import React from "react";
import { TextField, Alert, Typography } from "@mui/material";
import StepHeader from "../../_shared/StepHeader";
export interface PhoneStepProps {
  phone: string;
  setPhone: (v: string) => void;

  error?: string;
  loading: boolean;
}

const PhoneStepContent: React.FC<PhoneStepProps> = ({
  phone,
  setPhone,
  error,
}) => {
  return (
    <>
      <StepHeader title="Enter your phone number" />

      <TextField
        label="Phone Number"
        fullWidth
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+380931234567"
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </>
  );
};
export default PhoneStepContent;
