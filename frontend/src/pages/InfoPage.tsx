import React from "react";
import { Box, Paper, Typography } from "@mui/material";

const InfoPage: React.FC = () => {
  return (
    <Box>
      <Paper sx={{ p: 3, width: "100%" }}>
        <Typography variant="h4" gutterBottom>
          Welcome to UniMessenger
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage all your connected accounts and messages in one unified
          dashboard. Telegram integration is ready — Discord and Slack are next.
        </Typography>
      </Paper>
    </Box>
  );
};

export default InfoPage;
