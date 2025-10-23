/**
 * PhoneStep.tsx
 * 🔹 Step 1 of Telegram authentication
 * 🔹 Responsible only for:
 *    - collecting phone number
 *    - initiating authentication request via telegramAuthApi.sendCode()
 * 🔹 Does NOT handle backend details – only UI control flow.
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert, CircularProgress } from "@mui/material";
import SendToMobileIcon from "@mui/icons-material/SendToMobile";
import { telegramAuthApi } from "../../../../api/telegramAuth";
import { ApiError } from "../../../../api/ApiError";

interface PhoneStepProps {
  onNext: (
    phoneNumber: string,
    phoneCodeHash: string,
    tempSession: string
  ) => void;
}

const PhoneStep: React.FC<PhoneStepProps> = ({ onNext }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Trigger sending a login code to the user's phone number via backend Telegram API
   */
  const handleSendCode = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await telegramAuthApi.sendCode(phoneNumber);
      // Pass data to parent component (TelegramAuthModal)
      onNext(phoneNumber, result.phoneCodeHash, result.tempSession);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unexpected error occurred");
      }
    } finally {
      setLoading(false);
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
        placeholder="+380931234567"
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handleSendCode}
        disabled={loading || !phoneNumber}
      >
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            Send Code <SendToMobileIcon sx={{ ml: 1 }} />
          </>
        )}
      </Button>
    </Box>
  );
};

export default PhoneStep;
