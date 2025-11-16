// frontend/src/pages/accounts/telegram/TelegramAuthFlow.tsx
/**
 * TelegramAuthFlow.tsx
 * Unified, modern, state-machine–driven Telegram authentication flow.
 * Handles:
 *  - steps (phone → code → password → success)
 *  - api communication
 *  - state management
 *  - passing header/content/actions to modal
 */

import React, { useState } from "react";
import TelegramAuthModal from "./TelegramAuthModal";

// Steps (new architecture)
import PhoneStepContent from "./steps/PhoneStepContent";
import PhoneStepActions from "./steps/PhoneStepActions";
import CodeStepContent from "./steps/CodeStepContent";
import CodeStepActions from "./steps/CodeStepActions";
import PasswordStepContent from "./steps/PasswordStepContent";
import PasswordStepActions from "./steps/PasswordStepActions";
import SuccessStepContent from "./steps/SuccessStepContent";
import SuccessStepActions from "./steps/SuccessStepActions";

// API
import { telegramApi } from "../../../api/telegramApi";
import { ApiError } from "../../../api/ApiError";

type Step = "phone" | "code" | "password" | "success";

interface TelegramAuthFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const TelegramAuthFlow: React.FC<TelegramAuthFlowProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  // Flow state
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [tempSession, setTempSession] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");

  const [accountInfo, setAccountInfo] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Reset modal to initial state */
  const resetAll = () => {
    setStep("phone");
    setPhone("");
    setCode("");
    setPassword("");
    setPhoneCodeHash("");
    setTempSession("");
    setAccountInfo(null);
    setError(null);
    setLoading(false);
  };

  const exitFlow = () => {
    resetAll();
    onClose();
  };

  // ----------------------------
  //  STEP 1 — SEND PHONE
  // ----------------------------
  const handleSendPhone = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await telegramApi.sendCode(phone);

      setPhoneCodeHash(result.phoneCodeHash);
      setTempSession(result.tempSession);

      setStep("code");
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  //  STEP 2 — SEND CODE
  // ----------------------------
  const handleSendCode = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await telegramApi.signIn(
        phone,
        code,
        phoneCodeHash,
        tempSession
      );

      if ("needsPassword" in result) {
        // go to 2FA step
        setStep("password");
      } else {
        // success
        setAccountInfo(
          [result.firstName, result.lastName].filter(Boolean).join(" ") ||
            result.username ||
            "Unknown"
        );
        setStep("success");
        if (onComplete) onComplete();
      }
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  //  STEP 3 — SEND PASSWORD (2FA)
  // ----------------------------
  const handleSendPassword = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await telegramApi.verifyTwoFA(tempSession, password);

      setAccountInfo(
        [result.firstName, result.lastName].filter(Boolean).join(" ") ||
          result.username ||
          "Unknown"
      );
      setStep("success");

      if (onComplete) onComplete();
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  //  BUILD MODAL SLOTS FOR CURRENT STEP
  // ----------------------------

  let header = null;
  let content = null;
  let actions = null;

  switch (step) {
    case "phone":
      header = "Connect Telegram Account";
      content = (
        <PhoneStepContent phone={phone} error={error} onChange={setPhone} />
      );
      actions = (
        <PhoneStepActions
          loading={loading}
          isValid={phone.length > 5}
          onNext={handleSendPhone}
          onCancel={exitFlow}
        />
      );
      break;

    case "code":
      header = "Verification Code";
      content = (
        <CodeStepContent
          code={code}
          phoneNumber={phone}
          error={error}
          onChange={setCode}
        />
      );
      actions = (
        <CodeStepActions
          loading={loading}
          isValid={code.length > 2}
          onNext={handleSendCode}
          onCancel={exitFlow}
        />
      );
      break;

    case "password":
      header = "Two-Factor Authentication";
      content = (
        <PasswordStepContent
          password={password}
          error={error}
          onChange={setPassword}
        />
      );
      actions = (
        <PasswordStepActions
          loading={loading}
          isValid={password.length > 0}
          onNext={handleSendPassword}
          onCancel={exitFlow}
        />
      );
      break;

    case "success":
      header = "Success";
      content = <SuccessStepContent label={accountInfo} />;
      actions = <SuccessStepActions onClose={exitFlow} />;
      break;
  }

  return (
    <TelegramAuthModal
      open={open}
      onClose={exitFlow}
      header={header}
      content={content}
      actions={actions}
    />
  );
};

export default TelegramAuthFlow;
