// frontend/src/pages/inbox/chat/MessageDaySeparator.tsx
import { Box, Typography } from "@mui/material";

interface Props {
  date: string;
}

export default function MessageDaySeparator({ date }: Props) {
  const d = new Date(date);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();

  let label = d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });

  if (isToday) label = "Today";
  else if (isYesterday) label = "Yesterday";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: 1,
      }}
    >
      <Typography
        sx={{
          px: 1.6,
          py: 0.4,
          bgcolor: "rgba(128,128,128,0.15)",
          borderRadius: 999,
          fontSize: "12px",
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
