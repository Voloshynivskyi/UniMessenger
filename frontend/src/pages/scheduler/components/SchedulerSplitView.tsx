// frontend/src/pages/scheduler/components/SchedulerSplitView.tsx
import React from "react";
import { Box, Paper } from "@mui/material";

export default function SchedulerSplitView({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" },
        gap: 2,
        overflow: "hidden",
      }}
    >
      <Paper sx={{ borderRadius: 3, overflow: "hidden", height: "100%" }}>
        {left}
      </Paper>
      <Paper sx={{ borderRadius: 3, overflow: "hidden", height: "100%" }}>
        {right}
      </Paper>
    </Box>
  );
}
