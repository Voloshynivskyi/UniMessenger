/**
 * CodeStep.tsx
 * 🔹 Step 2 of Telegram authentication flow.
 * 🔹 Handles verification code submission after user receives it from Telegram.
 *
 * 🧠 Key responsibilities:
 *  - Accept code input
 *  - Call telegramAuthApi.signIn() with proper arguments
 *  - Determine whether user proceeds to:
 *      ✅ success (account connected)
 *      🔐 or password step (2FA required)
 *  - Handle and display ApiError feedback
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert, CircularProgress } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { telegramAuthApi } from "../../../../api/telegramAuth";
import { ApiError } from "../../../../api/ApiError";

interface CodeStepProps {
  phoneNumber: string;
  phoneCodeHash: string;
  tempSession: string;
  /** Called when Telegram requires password (2FA) */
  onPasswordRequired: (verificationCode: string) => void;
  /** Called when authentication is complete */
  onSuccess: (data: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
  }) => void;
}

const CodeStep: React.FC<CodeStepProps> = ({
  phoneNumber,
  phoneCodeHash,
  tempSession,
  onPasswordRequired,
  onSuccess,
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handles user confirmation of the SMS code.
   * Triggers Telegram sign-in and decides next step based on API response.
   */
  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await telegramAuthApi.signIn(
        phoneNumber,
        code,
        phoneCodeHash,
        tempSession
      );

      if ("needsPassword" in result) {
        onPasswordRequired(code);
      } else {
        // TS тепер знає, що result — це SignInSuccessResult
        onSuccess(result);
      }
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
        label="Verification Code"
        fullWidth
        sx={{ mb: 3 }}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter the code from Telegram"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handleSignIn}
        disabled={loading || !code}
      >
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            Confirm <LoginIcon sx={{ ml: 1 }} />
          </>
        )}
      </Button>
    </Box>
  );
};

export default CodeStep;
