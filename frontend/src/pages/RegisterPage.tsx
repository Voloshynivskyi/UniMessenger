/**
 * RegisterPage.tsx
 * ✨ Handles new user registration flow using centralized authApi and AuthContext.
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isValidEmail, isValidPassword } from "../utils/validation";
import PasswordField from "../ui/login/PasswordField";
import PasswordConfirmationField from "../ui/login/PasswordConfirmationField";
import { ApiError } from "../api/ApiError";

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
    <Box>
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          UniMessenger Register
        </Typography>

        <TextField
          error={!isValidEmail(email) && email.length > 0}
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        {errorMessage && (
          <Alert severity="error" sx={{ mb: "2vh" }}>
            {errorMessage}
          </Alert>
        )}

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
        </Button>

        <Typography sx={{ mb: "2vh", color: "text.secondary" }}>
          Already have an account? Sign in
        </Typography>

        <Button
          color="secondary"
          variant="contained"
          sx={{ width: "100%" }}
          onClick={() => navigate("/login")}
        >
          Sign in
        </Button>
      </Paper>
    </Box>
  );
};

export default RegisterPage;
