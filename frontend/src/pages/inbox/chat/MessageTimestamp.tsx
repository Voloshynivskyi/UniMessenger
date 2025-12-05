// frontend/src/pages/inbox/chat/MessageTimestamp.tsx
import { Typography } from "@mui/material";

export default function MessageTimestamp({ date }: { date: string }) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return (
    <Typography
      sx={{
        fontSize: "11px",
        opacity: 0.55,
        ml: 1,
        alignSelf: "flex-end",
        whiteSpace: "nowrap",
      }}
    >
      {hh}:{mm}
    </Typography>
  );
}
