// frontend/src/components/layout/sidebar/Sidebar.tsx
/**
 * Sidebar — now extends from top to bottom.
 * No changes to button styles.
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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../../context/AuthContext";

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  fullWidth: number;
  compactWidth: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
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
    { text: "Scheduler", icon: <CalendarMonthIcon />, path: "/scheduler" },
  ];

  const TitleBar = (
    <Box
      sx={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        px: collapsed ? 0 : 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {!collapsed && (
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: theme.palette.primary.main }}
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
                {/* Menu Item */}
                <ListItemButton
                  selected={isActive}
                  onClick={() => {
                    navigate(item.path);
                    if (!isDesktop) onClose();
                  }}
                  sx={{
                    borderRadius: 2,
                    mx: collapsed ? 1 : 2,
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
                  <ListItemIcon sx={{ minWidth: 28 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>

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
            }}
          >
            <ListItemIcon>
              {isAuthenticated ? (
                <LogoutIcon color="error" />
              ) : (
                <LoginIcon color="primary" />
              )}
            </ListItemIcon>
            <ListItemText primary={isAuthenticated ? "Log out" : "Log in"} />
          </ListItemButton>
        </Tooltip>
      </Box>
    </>
  );

  if (isDesktop) {
    const width = open ? (collapsed ? compactWidth : fullWidth) : 0;

    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width,
          transition: "width 0.25s ease-in-out",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight:
            width > 0 ? `1px solid ${theme.palette.divider}` : "none",
          backgroundColor: theme.palette.background.paper,
          zIndex: theme.zIndex.drawer,
        }}
      >
        {renderMenu}
      </Box>
    );
  }

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
