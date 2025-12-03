// src/components/chat/recorders/RecorderWaveform.tsx
import { Box } from "@mui/material";

interface Props {
  waveform: number[];
}

export default function RecorderWaveform({ waveform }: Props) {
  if (!waveform.length) return null;

  const normalized = waveform.map((v) => Math.max(0, Math.min(1, v / 255)));

  const TARGET_BARS = 60;
  const step = Math.max(1, Math.floor(normalized.length / TARGET_BARS));
  const bars = normalized.filter((_, i) => i % step === 0);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: "2px",
        height: 28,
      }}
    >
      {bars.map((v, i) => (
        <Box
          key={i}
          sx={{
            width: "2px",
            height: `${6 + v * 22}px`,
            bgcolor: "rgba(0,0,0,0.45)",
            borderRadius: 1,
            transition: "height 0.1s linear",
          }}
        />
      ))}
    </Box>
  );
}
