/**
 * PasswordStep.tsx
 * 🔐 Step 3 of Telegram authentication flow (Two-Factor Authentication).
 *
 * 🧠 Purpose:
 *  - Prompt user to enter Telegram password (if 2FA is enabled)
 *  - Submit password together with tempSession to complete authentication
 *  - On success → finalize session
 *
 * ✅ This component is responsible ONLY for UI and flow control.
 * ✅ All HTTP logic and validation are encapsulated in the telegramAuthApi layer.
 */

import React, { useState } from "react";
import { TextField, Button, Box, Alert, CircularProgress } from "@mui/material";
import { telegramAuthApi } from "../../../../api/telegramAuth";
import { ApiError } from "../../../../api/ApiError";

interface PasswordStepProps {
  tempSession: string;
  /** Called when user successfully completes login with password */
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

const PasswordStep: React.FC<PasswordStepProps> = ({
  tempSession,
  onSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handles final step of Telegram authentication.
   * Calls verifyTwoFA() via API and passes result to parent.
   */
  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await telegramAuthApi.verifyTwoFA(tempSession, password);
      onSuccess(result);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message); // Display server-provided error message
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
        type="password"
        label="Telegram Password"
        fullWidth
        sx={{ mb: 3 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your Telegram 2FA password"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handleSubmit}
        disabled={loading || !password}
      >
        {loading ? <CircularProgress size={24} /> : "Sign In"}
      </Button>
    </Box>
  );
};

export default PasswordStep;
