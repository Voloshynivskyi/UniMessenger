/**
 * frontend/src/components/accounts/NoAccountsPlaceholder.tsx
 * Simple elegant placeholder when no accounts are connected
 */

import React from "react";
import { Typography, Paper, IconButton } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
interface NoAccountsPlaceholderProps {
  onAddClick(): void;
}

const NoAccountsPlaceholder: React.FC<NoAccountsPlaceholderProps> = ({
  onAddClick,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        textAlign: "center",
        padding: 6,
        borderRadius: 4,
        backgroundColor: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <IconButton
        sx={{
          color: "green",
          "&:hover": {
            color: "darkgreen",
            transform: "scale(1.03)",
            transition: "all 0.2s",
          },
        }}
      >
        <AddCircleOutlineIcon
          sx={{ fontSize: "10rem", opacity: 0.6 }}
          onClick={onAddClick}
        />
      </IconButton>

      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        No connected accounts
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 300 }}
      >
        You haven’t connected any Telegram accounts yet.
      </Typography>
    </Paper>
  );
};

export default NoAccountsPlaceholder;
