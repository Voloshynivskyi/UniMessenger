// frontend/src/pages/auth/register/RegistrForm.tsx
import React from "react";
import { TextField } from "@mui/material";
import AuthFormFrame from "../AuthFormFrame";
import PasswordField from "../PasswordField";
import PasswordConfirmationField from "../PasswordConfirmationField";
import { isValidEmail, isValidPassword } from "../../../utils/validation";

interface RegisterFormProps {
  email: string;
  password: string;
  passwordConfirmation: string;
  error?: string;
  loading?: boolean;

  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setPasswordConfirmation: (v: string) => void;

  onSubmit: () => void;
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  password,
  passwordConfirmation,
  error,
  loading,
  setEmail,
  setPassword,
  setPasswordConfirmation,
  onSubmit,
  onSwitchToLogin,
}) => {
  const isDisabled =
    !isValidEmail(email) ||
    !isValidPassword(password).isValid ||
    password !== passwordConfirmation;

  return (
    <AuthFormFrame
      title="UniMessenger Register"
      error={error}
      loading={loading}
      submitLabel="Sign up"
      onSubmit={onSubmit}
      secondaryLabel="Already have an account? Sign in"
      onSecondary={onSwitchToLogin}
    >
      <TextField
        label="Email"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <PasswordField
        password={password}
        setPassword={setPassword}
        validation={true}
      />

      <PasswordConfirmationField
        password={password}
        passwordConfirmation={passwordConfirmation}
        setPasswordConfirmation={setPasswordConfirmation}
      />
    </AuthFormFrame>
  );
};

export default RegisterForm;
