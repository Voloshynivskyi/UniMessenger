// frontend/src/pages/scheduler/components/composer/ComposerHeader.tsx
import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

export default function ComposerHeader() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        p: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton onClick={() => navigate("/scheduler")} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Post composer
        </Typography>
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.75 }}>
        Select chats like Inbox · then schedule
      </Typography>
    </Box>
  );
}
