import React, { useMemo } from "react";
import { Box, Divider } from "@mui/material";
import SchedulerCalendarHeader from "./SchedulerCalendarHeader";
import SchedulerCalendarGrid from "./SchedulerCalendarGrid";
import { buildMonthGrid } from "./calendarUtils";
import type { SchedulerPost } from "../list/listUtils";

export default function SchedulerCalendar({
  monthCursor,
  onMonthChange,
  selectedDate,
  onSelectDate,
  posts,
}: {
  monthCursor: Date;
  onMonthChange: (d: Date) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  posts: SchedulerPost[];
}) {
  const grid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const handleSelectDate = (d: Date) => {
    onSelectDate(d);
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SchedulerCalendarHeader
        monthCursor={monthCursor}
        onMonthChange={onMonthChange}
      />
      <Divider />
      <SchedulerCalendarGrid
        grid={grid}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        posts={posts}
      />
    </Box>
  );
}
