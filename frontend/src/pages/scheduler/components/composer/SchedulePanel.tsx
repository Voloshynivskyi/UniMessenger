// frontend/src/pages/scheduler/components/composer/SchedulePanel.tsx
import React from "react";
import { Box, TextField, Typography } from "@mui/material";

export default function SchedulePanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
        Schedule time
      </Typography>

      <TextField
        label="Date & time"
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
      />

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 1, opacity: 0.75 }}
      >
        Timezone/recurrence will be added later, but basic datetime is already
        here.
      </Typography>
    </Box>
  );
}
