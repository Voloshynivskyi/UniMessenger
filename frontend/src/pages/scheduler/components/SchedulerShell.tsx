// frontend/src/pages/scheduler/components/SchedulerShell.tsx

import React from "react";
import { Box } from "@mui/material";
import SchedulerTopBar from "./SchedulerTopBar";

export default function SchedulerShell({
  onCreate,
  children,
}: {
  onCreate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <SchedulerTopBar onCreate={onCreate} />

      <Box sx={{ flex: 1, overflow: "hidden", p: 2 }}>{children}</Box>
    </Box>
  );
}
