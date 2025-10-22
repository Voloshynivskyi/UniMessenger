/**
 * frontend/src/components/accounts/telegram/steps/PhoneStep.tsx
 * First step of Telegram authentication - phone number input and code sending
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert } from "@mui/material";
import SendToMobileIcon from "@mui/icons-material/SendToMobile";
import apiClient from "../../../../api/apiClient";

interface PhoneStepProps {
  phoneCodeHash: string;
  onNext: (phoneNumber: string) => void;
  setTempSession: (session: string) => void;
  setPhoneCodeHash: (hash: string) => void;
}

const PhoneStep: React.FC<PhoneStepProps> = ({
  onNext,
  setPhoneCodeHash,
  setTempSession,
}) => {
  const [phoneNumber, setPhoneNumber] = useState("");

  const [error, setError] = useState("");

  const handleSendCode = async () => {
    try {
      const response = await apiClient.post("/api/telegram/sendCode", {
        phoneNumber,
      });
      if (response.data.status === "code_sent") {
        setPhoneCodeHash(response.data.phoneCodeHash);
        setTempSession(response.data.tempSession);
        onNext(phoneNumber);
      } else {
        setError(response.data.message || "Unknown response");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send code");
    }
  };

  return (
    <Box>
      <TextField
        label="Phone Number"
        fullWidth
        sx={{ mb: 3 }}
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button variant="contained" fullWidth onClick={handleSendCode}>
        Send Code <SendToMobileIcon sx={{ ml: 1 }} />
      </Button>
    </Box>
  );
};

export default PhoneStep;
