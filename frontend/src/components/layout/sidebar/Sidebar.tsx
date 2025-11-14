/**
 * Fixed desktop sidebar with smooth width animation and compact mode.
 * Mobile: temporary overlay drawer (no compact).
 */
import React from "react";
import {
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Typography,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../../context/AuthContext";

interface SidebarProps {
  open: boolean;
  collapsed: boolean; // compact mode
  onClose: () => void;
  onToggleCollapse: () => void; // toggle compact
  appBarHeight: number;
  fullWidth: number;
  compactWidth: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
  appBarHeight,
  fullWidth,
  compactWidth,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const menuItems = [
    { text: "Inbox", icon: <InboxIcon />, path: "/inbox" },
    { text: "Accounts", icon: <GroupWorkIcon />, path: "/accounts" },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/profile" },
    { text: "Settings", icon: <SettingsIcon />, path: "/settings" },
  ];

  // Title row (sticky)
  const TitleBar = (
    <Box
      sx={{
        height: appBarHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        px: collapsed ? 0 : 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: "sticky",
        top: 0,
        zIndex: 1,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {!collapsed && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: theme.palette.primary.main,
            userSelect: "none",
          }}
        >
          UniMessenger
        </Typography>
      )}
      {isDesktop && open && (
        <IconButton
          size="small"
          onClick={onToggleCollapse}
          sx={{
            ml: collapsed ? 0 : 1,
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
          }}
          aria-label="toggle compact"
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      )}
    </Box>
  );

  const renderMenu = (
    <>
      {TitleBar}

      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { width: "6px" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: theme.palette.action.hover,
            borderRadius: "4px",
          },
        }}
      >
        <List sx={{ py: 1 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Tooltip
                key={item.text}
                title={collapsed ? item.text : ""}
                placement="right"
                disableHoverListener={!collapsed}
              >
                <ListItemButton
                  selected={isActive}
                  onClick={() => {
                    navigate(item.path);
                    if (!isDesktop) onClose();
                  }}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    my: 0.5,

                    // Compact mode fixes
                    minHeight: 48,
                    px: collapsed ? 1 : 2, // symmetric padding when collapsed
                    justifyContent: collapsed ? "center" : "flex-start",

                    "& .MuiListItemIcon-root": {
                      minWidth: collapsed ? 0 : 40, // remove extra gap
                      mr: collapsed ? 0 : 2,
                      justifyContent: "center",
                    },

                    "& .MuiListItemText-root": {
                      display: collapsed ? "none" : "block",
                    },

                    "&.Mui-selected": {
                      backgroundColor: theme.palette.primary.main,
                      color: "white",
                      "& .MuiListItemIcon-root": { color: "white" },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: collapsed ? 0 : 1,
                      visibility: collapsed ? "hidden" : "visible",
                      transition: "opacity 0.2s ease",
                      whiteSpace: "nowrap",
                    }}
                  />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>

        <Divider />

        <Divider />

        <Tooltip
          title={collapsed ? (isAuthenticated ? "Log out" : "Log in") : ""}
          placement="right"
          disableHoverListener={!collapsed}
        >
          <ListItemButton
            onClick={() => {
              if (isAuthenticated) logout();
              else navigate("/login");
              if (!isDesktop) onClose();
            }}
            sx={{
              borderRadius: 2,
              mx: 1,
              my: 0.5,

              minHeight: 48,
              px: collapsed ? 1 : 2,
              justifyContent: collapsed ? "center" : "flex-start",

              "& .MuiListItemIcon-root": {
                minWidth: collapsed ? 0 : 40,
                mr: collapsed ? 0 : 2,
                justifyContent: "center",
              },

              "& .MuiListItemText-root": {
                display: collapsed ? "none" : "block",
              },

              "&.Mui-selected": {
                backgroundColor: theme.palette.primary.main,
                color: "white",
                "& .MuiListItemIcon-root": { color: "white" },
              },
            }}
          >
            <ListItemIcon>
              {isAuthenticated ? (
                <LogoutIcon color="error" />
              ) : (
                <LoginIcon color="primary" />
              )}
            </ListItemIcon>

            <ListItemText
              primary={isAuthenticated ? "Log out" : "Log in"}
              sx={{ whiteSpace: "nowrap" }}
            />
          </ListItemButton>
        </Tooltip>
      </Box>
    </>
  );

  // Desktop: fixed, animating width 0 / compact / full
  if (isDesktop) {
    const targetWidth = open ? (collapsed ? compactWidth : fullWidth) : 0;

    return (
      <Box
        sx={{
          position: "fixed",
          top: appBarHeight,
          left: 0,
          height: `calc(100vh - ${appBarHeight}px)`,
          width: `${targetWidth}px`,
          transition: "width 0.25s ease-in-out",
          display: "flex", // ← ВАЖЛИВО
          flexDirection: "column", // ← ВАЖЛИВО
          overflow: "hidden", // залишаємо, це ок
          borderRight:
            targetWidth > 0 ? `1px solid ${theme.palette.divider}` : "none",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {renderMenu}
      </Box>
    );
  }

  // Mobile: overlay drawer
  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: fullWidth,
          boxSizing: "border-box",
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      {renderMenu}
    </Drawer>
  );
};

export default Sidebar;
