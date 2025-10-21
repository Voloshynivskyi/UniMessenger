/**
 * frontend/src/pages/AccountsPage.tsx
 * Page for managing connected messaging accounts
 */

import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Modal,
  TextField,
  Button,
  Paper,
  Alert,
} from "@mui/material";
import apiClient from "../api/apiClient";
import SendToMobileIcon from "@mui/icons-material/SendToMobile";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
const AccountsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [step, setStep] = useState<
    "phone" | "code" | "code-password" | "success"
  >("phone");
  const handleSendCode = async () => {
    const requestBody = { phoneNumber };
    try {
      const response = await apiClient.post(
        "/api/telegram/sendcode",
        requestBody
      );
      if (response.data.status === "code_sent") {
        setStep("code");
      }
    } catch (error: any) {
      console.error("Send code failed:", error);
      setErrorMessage(error.response?.data?.message || "Send code failed");
    }
    console.log(`Sending code to ${phoneNumber}`);
  };
  const handleSignIn = async () => {
    const requestBody = {
      phoneNumber,
      phoneCode: code,
    };
    try {
      const response = await apiClient.post(
        "/api/telegram/signIn",
        requestBody
      );
      if (response.data.status === "ok") {
        setStep("success");
      }
      if (response.data.status === "need_password") {
        setStep("code-password");
      }
    } catch (error: any) {
      console.error("Sign in failed:", error);
      setErrorMessage(error.response?.data?.message || "Sign in failed");
    }
    console.log(`Signing in with code ${code}`);
  };
  const handleSignInWithPassword = async () => {
    const requestBody = {
      phoneNumber,
      phoneCode: code,
      password,
    };
    try {
      const response = await apiClient.post("/api/telegram/2fa", requestBody);
      if (response.data.status === "ok") {
        setStep("success");
      }
    } catch (error: any) {
      console.error("Sign in with password failed:", error);
      setErrorMessage(
        error.response?.data?.message || "Sign in with password failed"
      );
    }
    console.log(`Signing in with password`);
  };
  return (
    <Box sx={{ p: 0 }}>
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          Accounts Page
        </Typography>
        <IconButton
          onClick={() => setIsModalOpen(true)}
          sx={{ width: 40, height: 40 }}
          children={<AddIcon />}
        />
        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <Paper
            sx={{ margin: "20vh auto", p: "4vh", width: 500, borderRadius: 5 }}
          >
            <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
              Add New Account
            </Typography>

            {step === "phone" && (
              <TextField
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                label={"Phone Number"}
                sx={{ width: "100%", mb: "4vh" }}
              />
            )}
            {step === "code" && (
              <TextField
                value={code}
                onChange={(e) => setCode(e.target.value)}
                label={"Verification Code"}
                sx={{ width: "100%", mb: "4vh" }}
              />
            )}
            {step === "code-password" && (
              <TextField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                label="Password"
                sx={{ width: "100%", mb: "4vh" }}
                type="password"
              />
            )}

            {errorMessage && (
              <Alert severity="error" sx={{ mb: "2vh" }}>
                {errorMessage}
              </Alert>
            )}

            {step !== "phone" && (
              <Button
                color="primary"
                variant="contained"
                sx={{ mb: "2vh", width: "100%" }}
                onClick={handleSendCode}
              >
                Send Code
                <SendToMobileIcon sx={{ ml: 1 }} />
              </Button>
            )}
            {step === "success" && (
              <Box sx={{ textAlign: "center" }}>
                <DoneIcon sx={{ fontSize: 60, color: "green", mb: 2 }} />
                <Typography sx={{ fontSize: "h6.fontSize" }}>
                  Account Added Successfully!
                </Typography>
              </Box>
            )}
          </Paper>
        </Modal>
      </Paper>
    </Box>
  );
};

export default AccountsPage;
