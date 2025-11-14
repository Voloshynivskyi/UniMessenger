// frontend/src/pages/accounts/telegram/steps/CodeStepContent.tsx
import React from "react";
import { TextField, Alert, Typography } from "@mui/material";
import StepHeader from "../../_shared/StepHeader";
export interface CodeStepProps {
  code: string;
  setCode: (v: string) => void;

  error?: string;
  loading: boolean;
}

const CodeStepContent: React.FC<CodeStepProps> = ({ code, setCode, error }) => {
  return (
    <>
      <StepHeader title="Enter the verification code" />

      <TextField
        label="Verification Code"
        fullWidth
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="12345"
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </>
  );
};
export default CodeStepContent;
