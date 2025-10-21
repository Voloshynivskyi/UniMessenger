/**
 * frontend/src/pages/RegisterPage.tsx
 * Register page with email and password input fields
 */

import React from "react";
import { Box, Paper, Typography, TextField, Button } from "@mui/material";
import apiClient from "../api/apiClient";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginIcon from "@mui/icons-material/Login";
import { isValidPassword, isValidEmail } from "../utils/validation";
import PasswordField from "../ui/login/PasswordField";
import PasswordConfirmationField from "../ui/login/PasswordConfirmationField";
const RegisterPage: React.FC = () => {
  const { user, token, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/inbox", { replace: true });
    }
  }, [isAuthenticated]);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>("");

  async function handleRegister() {
    const requestBody = { email, password };
    try {
      const response = await apiClient.post("/api/auth/register", requestBody);
      login(response.data.token, response.data.user);
      navigate("/inbox");
    } catch (error) {
      console.error("Register failed:", error);
    }
  }

  return (
    <Box>
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          UniMessenger Register
        </Typography>
        <TextField
          error={!isValidEmail(email) && email.length > 0}
          onChange={(e) => setEmail(e.target.value)}
          label="Email"
          sx={{ width: "100%", mb: "4vh" }}
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
        <Button
          color="primary"
          variant="contained"
          sx={{ mb: "2vh", width: "100%" }}
          onClick={handleRegister}
          disabled={
            !isValidEmail(email) ||
            !isValidPassword(password).isValid ||
            password !== passwordConfirmation
          }
        >
          Sign up
          <LoginIcon sx={{ ml: 1 }} />
        </Button>
        <Typography sx={{ mb: "2vh", color: "text.secondary" }}>
          Already have an account? Sign in
        </Typography>
        <Button
          color="secondary"
          variant="contained"
          sx={{ mb: "2vh", width: "100%" }}
          onClick={() => navigate("/login")}
        >
          Sign in
        </Button>
      </Paper>
    </Box>
  );
};

export default RegisterPage;
