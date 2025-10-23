/**
 * TelegramAuthModal.tsx
 * 🔄 Master modal component orchestrating the multi-step Telegram authentication flow.
 *
 * 📌 Responsibilities:
 *  - Manages UI steps (phone → code → password → success)
 *  - Stores intermediate auth state (phone, phoneCodeHash, tempSession, etc.)
 *  - Handles final success action (e.g. refresh account list, close modal)
 *
 * ❗ This component does NOT directly interact with API.
 *     All network calls are made inside step components via telegramAuthApi.
 */

import React, { useState } from "react";
import { Modal, Paper } from "@mui/material";
import PhoneStep from "./steps/PhoneStep";
import CodeStep from "./steps/CodeStep";
import PasswordStep from "./steps/PasswordStep";
import SuccessStep from "./steps/SuccessStep";

interface TelegramAuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when authentication is completed successfully */
  onComplete?: () => void; // (optional) parent can refresh account list
}

type Step = "phone" | "code" | "password" | "success";

const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<Step>("phone");

  // Temporary state shared across steps
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [tempSession, setTempSession] = useState("");
  const [accountInfo, setAccountInfo] = useState<any>(null);

  /**
   * Move from PhoneStep → CodeStep
   */
  const handlePhoneSuccess = (phone: string, hash: string, temp: string) => {
    setPhoneNumber(phone);
    setPhoneCodeHash(hash);
    setTempSession(temp);
    setStep("code");
  };

  /**
   * Move from CodeStep → PasswordStep (if 2FA required)
   */
  const handlePasswordRequired = (code: string) => {
    // we store the code only if backend requires password
    setStep("password");
  };

  /**
   * Handle successful final authentication
   */
  const handleSuccess = (data: any) => {
    setAccountInfo(data);
    setStep("success");

    // Optionally notify parent to refresh list
    if (onComplete) onComplete();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Paper
        sx={{
          margin: "20vh auto",
          p: "4vh",
          width: 500,
          borderRadius: 5,
        }}
      >
        {step === "phone" && <PhoneStep onNext={handlePhoneSuccess} />}

        {step === "code" && (
          <CodeStep
            phoneNumber={phoneNumber}
            phoneCodeHash={phoneCodeHash}
            tempSession={tempSession}
            onPasswordRequired={handlePasswordRequired}
            onSuccess={handleSuccess}
          />
        )}

        {step === "password" && (
          <PasswordStep tempSession={tempSession} onSuccess={handleSuccess} />
        )}

        {step === "success" && (
          <SuccessStep accountInfo={accountInfo} onClose={onClose} />
        )}
      </Paper>
    </Modal>
  );
};

export default TelegramAuthModal;
