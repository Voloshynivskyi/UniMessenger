// frontend/src/components/common/LoadingSpinner.tsx
import { CircularProgress } from "@mui/material";

interface Props {
  size?: number;
  color?:
    | "inherit"
    | "primary"
    | "secondary"
    | "success"
    | "error"
    | "info"
    | "warning"
    | "white";
}

export default function LoadingSpinner({
  size = 32,
  color = "primary",
}: Props) {
  return (
    <CircularProgress
      size={size}
      sx={{
        color: color === "white" ? "white" : `${color}.main`,
      }}
    />
  );
}
