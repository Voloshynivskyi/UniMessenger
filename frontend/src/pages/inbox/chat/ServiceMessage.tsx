// frontend/src/pages/inbox/chat/ServiceMessage.tsx

import { Box, Typography } from "@mui/material";

export default function ServiceMessage({ text }: { text: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: 0.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          px: 1.2,
          py: 0.4,
          bgcolor: "rgba(128,128,128,0.15)",
          borderRadius: 2,
          color: "text.secondary",
          fontSize: "12px",
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
