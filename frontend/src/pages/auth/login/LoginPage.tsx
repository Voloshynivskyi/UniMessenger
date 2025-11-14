/**
 * LoginPage.tsx
 * 🔐 Page component responsible for user authentication via email and password.
 *
 * ✅ Uses authApi + AuthContext for centralized logic
 * ✅ Shows validation errors from ApiError
 * ✅ Redirects upon successful login
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import PasswordField from "../../../ui/login/PasswordField";
import { ApiError } from "../../../api/ApiError";
import PageContainer from "../../../components/common/PageContainer";

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
      await login(email, password); // виклик контексту, а не API напряму
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
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          UniMessenger Login
        </Typography>

        <TextField
          label="Email"
          sx={{ width: "100%", mb: "4vh" }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          password={password}
          setPassword={setPassword}
          validation={false}
        />

        {errorMessage && (
          <Alert severity="error" sx={{ mb: "2vh" }}>
            {errorMessage}
          </Alert>
        )}

        <Button
          color="primary"
          variant="contained"
          sx={{ mb: "2vh", width: "100%" }}
          onClick={handleLogin}
          disabled={!email || !password}
        >
          Sign in
          <LoginIcon sx={{ ml: 1 }} />
        </Button>

        <Divider sx={{ m: 2 }} />

        <Typography sx={{ mb: "2vh", color: "text.secondary" }}>
          Don't have an account? Sign up
        </Typography>

        <Button
          color="secondary"
          variant="contained"
          sx={{ width: "100%" }}
          onClick={() => navigate("/register")}
        >
          Sign up
        </Button>
      </Paper>
    </PageContainer>
  );
};

export default LoginPage;
