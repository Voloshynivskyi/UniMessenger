// frontend/src/components/layout/header/Header.tsx
/**
 * Header.tsx — AppBar адаптований до ширини Sidebar.
 */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Box,
  Tooltip,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import FilterListIcon from "@mui/icons-material/FilterList";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";

import { useAuth } from "../../../context/AuthContext";

interface HeaderProps {
  sidebarWidth: number;
  onMenuToggle: () => void;
  onAccountFilterClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  sidebarWidth,
  onMenuToggle,
  onAccountFilterClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const getTitle = () => {
    if (location.pathname.startsWith("/accounts")) return "Accounts";
    if (location.pathname.startsWith("/profile")) return "Profile";
    if (location.pathname.startsWith("/settings")) return "Settings";
    if (location.pathname.startsWith("/inbox")) return "Unified Inbox";
    if (location.pathname.startsWith("/login")) return "Login";
    if (location.pathname.startsWith("/register")) return "Register";
    return "Unified Inbox";
  };

  return (
    <AppBar
      position="fixed"
      elevation={1}
      sx={{
        ml: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`,
        transition: "margin-left 0.25s ease, width 0.25s ease",
        background: "linear-gradient(to right, #1976d2, #2196f3)",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          px: 2,
        }}
      >
        {/* Left */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton color="inherit" onClick={onMenuToggle}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {getTitle()}
          </Typography>
        </Box>

        {/* Right */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {isAuthenticated && (
            <Tooltip title="Filter accounts">
              <IconButton color="inherit" onClick={onAccountFilterClick}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
          )}

          {isAuthenticated ? (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={() => logout()}
            >
              Log out
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<LoginIcon />}
              onClick={() => navigate("/login")}
            >
              Log in
            </Button>
          )}

          {isAuthenticated && (
            <IconButton color="inherit" onClick={() => navigate("/profile")}>
              <AccountCircleIcon />
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
