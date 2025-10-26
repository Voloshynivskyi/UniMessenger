/**
 * PhoneStep.tsx
 * 🔹 Step 1 of Telegram authentication
 * 🔹 Responsible only for:
 *    - collecting phone number
 *    - initiating authentication request via telegramAuthApi.sendCode()
 * 🔹 Does NOT handle backend details – only UI control flow.
 */

import React, { useState } from "react";
import {
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import SendToMobileIcon from "@mui/icons-material/SendToMobile";
import { telegramApi } from "../../../../api/telegramApi";
import { ApiError } from "../../../../api/ApiError";
import CancelButton from "../../../../ui/login/common/CancelButton";
interface PhoneStepProps {
  onNext: (
    phoneNumber: string,
    phoneCodeHash: string,
    tempSession: string
  ) => void;
  onCancel: () => void;
}

const PhoneStep: React.FC<PhoneStepProps> = ({ onNext, onCancel }) => {
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
      const result = await telegramApi.sendCode(phoneNumber);
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
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Enter your phone number
      </Typography>
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
      <CancelButton onClick={onCancel} sx={{ mt: 2 }}>
        Cancel
      </CancelButton>
    </Box>
  );
};

export default PhoneStep;
