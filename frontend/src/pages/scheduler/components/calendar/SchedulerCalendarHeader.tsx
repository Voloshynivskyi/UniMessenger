// frontend/src/pages/scheduler/components/calendar/SchedulerCalendarHeader.tsx
import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { addMonths, formatMonthTitle } from "./calendarUtils";

export default function SchedulerCalendarHeader({
  monthCursor,
  onMonthChange,
}: {
  monthCursor: Date;
  onMonthChange: (d: Date) => void;
}) {
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
        <IconButton onClick={() => onMonthChange(addMonths(monthCursor, -1))}>
          <ChevronLeftIcon />
        </IconButton>
        <IconButton onClick={() => onMonthChange(addMonths(monthCursor, 1))}>
          <ChevronRightIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {formatMonthTitle(monthCursor)}
        </Typography>
      </Stack>

      <IconButton
        onClick={() => onMonthChange(new Date())}
        title="Go to current month"
      >
        <TodayIcon />
      </IconButton>
    </Box>
  );
}
