// frontend/src/components/common/TypingIndicator.tsx
import { Box, keyframes } from "@mui/material";

const blink = keyframes`
  0% { opacity: 0.2; transform: translateY(0); }
  20% { opacity: 1; transform: translateY(-2px); }
  100% { opacity: 0.2; transform: translateY(0); }
`;

export const TypingIndicator = () => (
  <Box sx={{ display: "inline-flex", gap: "3px", ml: "4px" }}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        sx={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: "primary.main",
          animation: `${blink} 1.4s infinite ease-in-out`,
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
  </Box>
);
