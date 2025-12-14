// frontend/src/pages/scheduler/components/calendar/SchedulerCalendarGrid.tsx

import React, { useMemo } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { isSameDay, dayKey } from "./calendarUtils";
import type { SchedulerPost } from "../list/listUtils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SchedulerCalendarGrid({
  grid,
  selectedDate,
  onSelectDate,
  posts,
}: {
  grid: { cells: Array<{ date: Date; inMonth: boolean }> };
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  posts: SchedulerPost[];
}) {
  const today = new Date();

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) {
      const key = dayKey(new Date(p.scheduledAt));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [posts]);

  return (
    <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          mb: 1,
        }}
      >
        {WEEKDAYS.map((d) => (
          <Typography
            key={d}
            variant="caption"
            sx={{ opacity: 0.7, fontWeight: 800, textAlign: "center" }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      <Box
        sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}
      >
        {grid.cells.map(({ date, inMonth }, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const count = countByDay.get(dayKey(date)) ?? 0;

          return (
            <Box
              key={`${date.toISOString()}-${idx}`}
              onClick={() => onSelectDate(date)}
              sx={(theme) => ({
                cursor: "pointer",
                borderRadius: 2,
                p: 1,
                minHeight: 74,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: isSelected
                  ? theme.palette.primary.main
                  : "transparent",
                color: isSelected ? "white" : "inherit",
                opacity: inMonth ? 1 : 0.45,
                outline: isToday
                  ? `2px solid ${theme.palette.warning.main}`
                  : "none",
                outlineOffset: 1,
              })}
            >
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                  {date.getDate()}
                </Typography>

                {count > 0 && (
                  <Chip
                    size="small"
                    label={`${count} post${count === 1 ? "" : "s"}`}
                  />
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
