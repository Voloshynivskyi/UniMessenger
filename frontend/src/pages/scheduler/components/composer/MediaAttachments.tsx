// frontend/src/pages/scheduler/components/composer/MediaAttachments.tsx
import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import AttachFileIcon from "@mui/icons-material/AttachFile";

export default function MediaAttachments() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
        Media (placeholder)
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button
          variant="outlined"
          startIcon={<ImageIcon />}
          sx={{ borderRadius: 2 }}
        >
          Add images
        </Button>
        <Button
          variant="outlined"
          startIcon={<AttachFileIcon />}
          sx={{ borderRadius: 2 }}
        >
          Add file
        </Button>
      </Stack>

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 1, opacity: 0.75 }}
      >
        Crop/collage is a separate phase. Currently focusing on: chat picker +
        schedule.
      </Typography>
    </Box>
  );
}
