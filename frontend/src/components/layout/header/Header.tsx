/**
 * frontend/src/components/layout/header/Header.tsx
 * Universal AppBar with hamburger, dynamic title, account filter, and auth actions.
 */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
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
  onMenuToggle: () => void;
  onAccountFilterClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  onAccountFilterClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // Detect current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith("/accounts")) return "Accounts";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/inbox")) return "Unified Inbox";
    return "Unified Inbox";
  };

  return (
    <AppBar
      position="fixed"
      elevation={1}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: "linear-gradient(to right, #1976d2, #2196f3)",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2,
        }}
      >
        {/* Left side: Hamburger + Title */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={onMenuToggle}
            sx={{
              mr: 1,
              transition: "transform 0.15s ease",
              "&:active": { transform: "scale(0.9)" },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 600,
              letterSpacing: 0.5,
              userSelect: "none",
            }}
          >
            {getPageTitle()}
          </Typography>
        </Box>

        {/* Right side: Filters, Auth buttons, Profile */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {isAuthenticated && (
            <Tooltip title="Select visible accounts">
              <IconButton
                color="inherit"
                onClick={onAccountFilterClick}
                sx={{
                  bgcolor: "rgba(255,255,255,0.1)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                }}
              >
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
              sx={{
                textTransform: "none",
                fontWeight: 500,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              Log out
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LoginIcon />}
              onClick={() => navigate("/login")}
              sx={{
                textTransform: "none",
                fontWeight: 500,
                boxShadow: "none",
              }}
            >
              Log in
            </Button>
          )}

          {isAuthenticated && (
            <IconButton
              color="inherit"
              onClick={() => navigate("/profile")}
              sx={{
                bgcolor: "rgba(255,255,255,0.1)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
              }}
            >
              <AccountCircleIcon />
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
