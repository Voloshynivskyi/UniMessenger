// frontend/src/pages/inbox/chat/recorders/RecorderWaveform.tsx

import { Box } from "@mui/material";

interface Props {
  waveform: number[];
}

export default function RecorderWaveform({ waveform }: Props) {
  if (!waveform || waveform.length === 0) return null;

  const normalized = waveform.map((v) => Math.min(1, v / 255));
  const count = 48;
  const step = Math.max(1, Math.floor(normalized.length / count));
  const bars = normalized.filter((_, i) => i % step === 0);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center", // Vertically centered for symmetry
        gap: "2px",
        height: 40,
      }}
    >
      {bars.map((v, i) => {
        const h = 4 + v * 30;
        return (
          <Box
            key={i}
            sx={{
              flex: 1,
              maxWidth: 4,
              height: `${h}px`,
              bgcolor: "rgba(0,0,0,0.55)",
              borderRadius: 999,
              transition: "height 0.06s linear",
            }}
          />
        );
      })}
    </Box>
  );
}
