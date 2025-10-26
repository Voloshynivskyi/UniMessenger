/**
 * frontend/src/components/accounts/AccountListItem.tsx
 * Stylish clickable ListItem for a Telegram account
 */
import React from "react";
import {
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Chip,
  Divider,
  ListItemButton,
  Typography,
  Box,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import TelegramIcon from "@mui/icons-material/Telegram"; // можна замінити або кастомізувати
import type { TelegramAuthAccount } from "../../api/telegramApi";

interface AccountListItemProps {
  account: TelegramAuthAccount;
  onClick?: () => void;
  onInfoClick?: () => void;
  onLogoutClick: (accountId: string) => void;
}

export const AccountListItem: React.FC<AccountListItemProps> = ({
  account,
  onClick,
  onInfoClick,
  onLogoutClick,
}) => {
  const displayName =
    account.username ||
    `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
    account.phoneNumber ||
    `ID: ${account.telegramId}`;

  const secondaryText = account.phoneNumber
    ? `Phone: ${account.phoneNumber}`
    : `Telegram ID: ${account.telegramId}`;

  return (
    <>
      <ListItem
        alignItems="flex-start"
        secondaryAction={
          <Box>
            <Chip
              sx={{
                mr: 2,
                fontSize: "0.6rem",
                height: 20,
                lineHeight: "20px",
              }}
              color={account.isActive ? "success" : "error"}
              label={account.isActive ? "● Active" : "● Inactive"}
            />
            <IconButton
              edge="end"
              aria-label="details"
              onClick={onInfoClick}
              sx={{ mr: 1 }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton
              edge="end"
              aria-label="logout"
              onClick={() => onLogoutClick(account.accountId)}
            >
              <LogoutIcon sx={{ fontSize: 25 }} />
            </IconButton>
          </Box>
        }
        disablePadding
      >
        <ListItemButton onClick={onClick}>
          <ListItemAvatar sx={{ mr: 1 }}>
            <Avatar sx={{ width: 40, height: 40 }}>
              <TelegramIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Typography
                sx={{ fontWeight: 500, fontSize: "1rem", display: "flex" }}
              >
                {displayName}
              </Typography>
            }
          />
        </ListItemButton>
      </ListItem>
      <Divider variant="inset" component="li" />
    </>
  );
};
