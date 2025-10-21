/**
 * frontend/src/components/Layout/header/Header.tsx
 * Application header with navigation title and login button
 */

import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
const Header: React.FC = () => {
  const buttonWidth = "100px";
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: "linear-gradient(to right, #1976d2, #2196f3)",
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          noWrap
          component="div"
          onClick={() => navigate("/")}
          sx={{ cursor: "pointer", mr: "80%" }}
        >
          UniMessenger
        </Typography>

        {isAuthenticated ? (
          <Button
            variant="contained"
            color="error"
            sx={{ width: buttonWidth, boxShadow: "none" }}
            onClick={() => {
              logout();
            }}
          >
            Log out
          </Button>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            sx={{ width: buttonWidth, boxShadow: "none" }}
            onClick={() => navigate("/login")}
          >
            Log in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
