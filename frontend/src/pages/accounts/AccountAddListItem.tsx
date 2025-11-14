/**
 * Modern minimalistic "Add account" list item.
 */

import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

interface AccountAddListItemProps {
  onClick: () => void;
  label?: string;
}

const AccountAddListItem: React.FC<AccountAddListItemProps> = ({
  onClick,
  label = "Add Telegram account",
}) => {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={onClick}
        sx={{
          borderRadius: 1.5,
          px: 1.5,
          py: 1.2,
          transition: "0.15s",
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.2,
          }}
        >
          {/* Icon */}
          <AddIcon
            sx={{
              fontSize: 22,
              color: theme.palette.text.secondary,
              transition: "0.15s",
              "&:hover": { color: theme.palette.primary.main },
            }}
          />

          {/* Label */}
          {!isSmDown && (
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: "0.95rem",
                color: theme.palette.text.secondary,
              }}
            >
              {label}
            </Typography>
          )}
        </Box>
      </ListItemButton>
    </ListItem>
  );
};

export default AccountAddListItem;
