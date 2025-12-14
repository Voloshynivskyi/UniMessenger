// frontend/src/pages/scheduler/components/SchedulerTopBar.tsx
import React from "react";
import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export default function SchedulerTopBar({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <Box
      sx={(theme) => ({
        height: 64,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
      })}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Scheduler
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Stack direction="row" spacing={1}>
          <Chip size="small" label="Draft" variant="outlined" />
          <Chip size="small" label="Scheduled" variant="outlined" />
          <Chip size="small" label="Sent" variant="outlined" />
          <Chip size="small" label="Failed" variant="outlined" />
        </Stack>
      </Stack>

      <Button
        onClick={onCreate}
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ borderRadius: 2 }}
      >
        Create post
      </Button>
    </Box>
  );
}
