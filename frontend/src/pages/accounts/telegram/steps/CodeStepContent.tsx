import React from "react";
import { Box, TextField, Alert } from "@mui/material";
import StepHeader from "../../_shared/StepHeader";
import StepContainer from "../../_shared/StepContainer";

interface Props {
  code: string;
  phoneNumber: string;
  error?: string | null;
  onChange: (v: string) => void;
}

const CodeStepContent: React.FC<Props> = ({
  code,
  onChange,
  error,
  phoneNumber,
}) => {
  return (
    <StepContainer>
      <StepHeader
        title="Enter Verification Code"
        subtitle={`We've sent a code to ${phoneNumber}`}
      />

      <TextField
        label="Verification code"
        fullWidth
        value={code}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12345"
      />

      {error && <Alert severity="error">{error}</Alert>}
    </StepContainer>
  );
};

export default CodeStepContent;
