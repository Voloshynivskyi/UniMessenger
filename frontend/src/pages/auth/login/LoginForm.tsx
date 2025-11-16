// frontend/src/pages/auth/login/LoginForm.tsx
import React from "react";
import { TextField } from "@mui/material";
import AuthFormFrame from "../AuthFormFrame";
import PasswordField from "../PasswordField";

interface LoginFormProps {
  email: string;
  password: string;
  error?: string;
  loading?: boolean;

  setEmail: (v: string) => void;
  setPassword: (v: string) => void;

  onSubmit: () => void;
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  error,
  loading,
  setEmail,
  setPassword,
  onSubmit,
  onSwitchToRegister,
}) => {
  return (
    <AuthFormFrame
      title="UniMessenger Login"
      error={error}
      loading={loading}
      submitLabel="Sign in"
      onSubmit={onSubmit}
      secondaryLabel="Don't have an account? Sign up"
      onSecondary={onSwitchToRegister}
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
        validation={false}
      />
    </AuthFormFrame>
  );
};

export default LoginForm;
