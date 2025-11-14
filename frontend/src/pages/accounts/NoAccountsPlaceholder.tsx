/**
 * Modern minimalistic placeholder when there are no accounts.
 */
import React from "react";
import { Box, Typography, IconButton, useTheme } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

interface NoAccountsPlaceholderProps {
  onAddClick(): void;
}

const NoAccountsPlaceholder: React.FC<NoAccountsPlaceholderProps> = ({
  onAddClick,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        textAlign: "center",
        py: 5,
        px: 2,
        borderRadius: 2,
        backgroundColor: theme.palette.action.hover,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Small modern icon */}
      <IconButton
        onClick={onAddClick}
        sx={{
          bgcolor: theme.palette.background.paper,
          width: 56,
          height: 56,
          borderRadius: "50%",
          boxShadow: 1,
          "&:hover": {
            bgcolor: theme.palette.action.selected,
          },
        }}
      >
        <AddCircleOutlineIcon sx={{ fontSize: 28 }} />
      </IconButton>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        No connected accounts
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 280 }}
      >
        You haven’t connected any Telegram accounts yet. Add your first one to
        get started.
      </Typography>
    </Box>
  );
};

export default NoAccountsPlaceholder;
