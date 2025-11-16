// frontend/src/pages/auth/register/RegisterPage.tsx
/**
 * RegisterPage.tsx
 * ✨ Handles new user registration flow using centralized authApi and AuthContext.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { ApiError } from "../../../api/ApiError";
import PageContainer from "../../../components/common/PageContainer";
import SectionCard from "../../../components/common/SectionCard";
import RegisterForm from "./RegisterForm";

const RegisterPage: React.FC = () => {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/inbox", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleRegister() {
    setErrorMessage("");
    try {
      await register(email, password);
      navigate("/inbox");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Registration failed due to unexpected error.");
      }
    }
  }

  return (
    <PageContainer>
      <SectionCard>
        <RegisterForm
          email={email}
          password={password}
          passwordConfirmation={passwordConfirmation}
          error={errorMessage}
          loading={false}
          setEmail={setEmail}
          setPassword={setPassword}
          setPasswordConfirmation={setPasswordConfirmation}
          onSubmit={handleRegister}
          onSwitchToLogin={() => navigate("/login")}
        />
      </SectionCard>
    </PageContainer>
  );
};

export default RegisterPage;
