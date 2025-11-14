// frontend/src/pages/accounts/AccountListItem.tsx
/**
 * Adaptive, clickable, modern AccountListItem with responsive layout.
 */
import React from "react";
import {
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import TelegramIcon from "@mui/icons-material/Telegram";
import type { TelegramAuthAccount } from "../../api/telegramApi";

interface AccountListItemProps {
  account: TelegramAuthAccount;
  refresh: () => void;
  onClick?: () => void;
  onInfoClick?: () => void;
  onLogoutClick: (accountId: string) => void;
}

export const AccountListItem: React.FC<AccountListItemProps> = ({
  account,
  refresh,
  onClick,
  onInfoClick,
  onLogoutClick,
}) => {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  const displayName =
    account.username ||
    `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
    account.phoneNumber ||
    `ID: ${account.telegramId}`;

  return (
    <ListItem
      disablePadding
      sx={{
        minHeight: 64,
        px: 1,
        alignItems: "center",
      }}
      secondaryAction={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.2,
            pr: 0.5,
            ml: 1,
          }}
        >
          {/* Status dot + adaptive label */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              color: "text.secondary",
              fontSize: "0.8rem",
              minWidth: isSmDown ? "unset" : "70px",
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: account.isActive ? "success.main" : "error.main",
              }}
            />
            {/* Hide text on very small screens */}
            {!isSmDown && (account.isActive ? "Active" : "Inactive")}
          </Box>

          {/* Info button */}
          <IconButton size="small" onClick={onInfoClick}>
            <InfoOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>

          {/* Logout button */}
          <IconButton
            size="small"
            onClick={() => {
              onLogoutClick(account.accountId);
              refresh();
            }}
          >
            <LogoutIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      }
    >
      {/* CLICKABLE PART */}
      <ListItemButton onClick={onClick} sx={{ pr: 10 }}>
        <ListItemAvatar>
          <Avatar sx={{ width: 40, height: 40 }}>
            <TelegramIcon sx={{ fontSize: 22 }} />
          </Avatar>
        </ListItemAvatar>

        <ListItemText
          primary={
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: "1rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: isMdDown ? "140px" : "250px",
              }}
            >
              {displayName}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};
