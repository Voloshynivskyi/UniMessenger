/**
 * frontend/src/components/accounts/telegram/TelegramAuthModal.tsx
 * Modal component for Telegram account authentication with multi-step flow
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
}

const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  open,
  onClose,
}) => {
  const [step, setStep] = useState<"phone" | "code" | "password" | "success">(
    "phone"
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [tempSession, setTempSession] = useState("");
  const [code, setCode] = useState("");
  const [accountInfo, setAccountInfo] = useState<any>(null);

  const handlePhoneSuccess = (phone: string) => {
    setPhoneNumber(phone);
    setStep("code");
  };

  const handleCodeSuccess = (data: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => {
    setStep("success");
    setAccountInfo(data);
  };

  const handleCodeNeedPassword = (verificationCode: string) => {
    setCode(verificationCode);
    setStep("password");
  };

  const handlePasswordSuccess = (data: {
    telegramId: string;
    accountId: string;
    username: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => {
    setStep("success");
    setAccountInfo(data);
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
        {step === "phone" && (
          <PhoneStep
            onNext={handlePhoneSuccess}
            phoneCodeHash={phoneCodeHash}
            setTempSession={setTempSession}
            setPhoneCodeHash={setPhoneCodeHash}
          />
        )}

        {step === "code" && (
          <CodeStep
            phoneNumber={phoneNumber}
            phoneCodeHash={phoneCodeHash}
            tempSession={tempSession}
            onSuccess={handleCodeSuccess}
            onPasswordRequired={handleCodeNeedPassword}
          />
        )}

        {step === "password" && (
          <PasswordStep
            phoneNumber={phoneNumber}
            phoneCodeHash={phoneCodeHash}
            code={code}
            onSuccess={handlePasswordSuccess}
            tempSession={tempSession}
          />
        )}

        {step === "success" && <SuccessStep accountInfo={accountInfo} />}
      </Paper>
    </Modal>
  );
};

export default TelegramAuthModal;
