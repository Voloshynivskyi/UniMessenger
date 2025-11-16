// frontend/src/pages/auth/login/LoginPage.tsx
/**
 * LoginPage.tsx
 *  Page component responsible for user authentication via email and password.
 *
 *  Uses authApi + AuthContext for centralized logic
 *  Shows validation errors from ApiError
 *  Redirects upon successful login
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { ApiError } from "../../../api/ApiError";
import PageContainer from "../../../components/common/PageContainer";
import SectionCard from "../../../components/common/SectionCard";
import LoginForm from "./LoginForm";

const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/inbox", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleLogin() {
    setErrorMessage("");
    try {
      await login(email, password);
      navigate("/inbox");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Unexpected error occurred");
      }
    }
  }

  return (
    <PageContainer>
      <SectionCard>
        <LoginForm
          email={email}
          password={password}
          error={errorMessage}
          loading={false}
          setEmail={setEmail}
          setPassword={setPassword}
          onSubmit={handleLogin}
          onSwitchToRegister={() => navigate("/register")}
        />
      </SectionCard>
    </PageContainer>
  );
};

export default LoginPage;
