/**
 * frontend/src/pages/LoginPage.tsx
 * Login page with email and password input fields
 */

import React from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import apiClient from "../api/apiClient";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginIcon from "@mui/icons-material/Login";
import PasswordField from "../ui/login/PasswordField";
const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/inbox", { replace: true });
    }
  }, [isAuthenticated]);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  async function handleLogin() {
    const requestBody = { email, password };
    try {
      const response = await apiClient.post("/api/auth/login", requestBody);
      login(response.data.token, response.data.user);
      navigate("/inbox");
    } catch (error: any) {
      console.error("Login failed:", error);
      setErrorMessage(error.response?.data?.message || "Login failed");
    }
  }

  return (
    <Box sx={{ p: 0 }}>
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          UniMessenger Login
        </Typography>
        <TextField
          onChange={(e) => setEmail(e.target.value)}
          label="Email"
          sx={{ width: "100%", mb: "4vh" }}
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
          sx={{ mb: "2vh", width: "100%" }}
          onClick={() => navigate("/register")}
        >
          Sign up
        </Button>
      </Paper>
    </Box>
  );
};

export default LoginPage;
