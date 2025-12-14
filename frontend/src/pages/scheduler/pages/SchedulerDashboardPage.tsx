import React, { useEffect } from "react";
import { Box } from "@mui/material";
import SchedulerSplitView from "../components/SchedulerSplitView";
import SchedulerCalendar from "../components/calendar/SchedulerCalendar";
import ScheduledPostsList from "../components/list/ScheduledPostsList";
import { useScheduler } from "../../../context/SchedulerContext";

export default function SchedulerDashboardPage() {
  const {
    posts,
    selectedDate,
    monthCursor,
    setSelectedDate,
    setMonthCursor,
    postsForSelectedDate,
    loadPostsForMonth,
  } = useScheduler();

  useEffect(() => {
    loadPostsForMonth(monthCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  return (
    <Box sx={{ height: "100%" }}>
      <SchedulerSplitView
        left={
          <SchedulerCalendar
            monthCursor={monthCursor}
            onMonthChange={setMonthCursor}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            posts={posts}
          />
        }
        right={
          <ScheduledPostsList
            selectedDate={selectedDate}
            posts={postsForSelectedDate}
          />
        }
      />
    </Box>
  );
}
