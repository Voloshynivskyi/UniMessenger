// frontend/src/pages/auth/AuthFormFrame.tsx
import React from "react";
import {
  Box,
  Typography,
  Alert,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";

interface AuthFormFrameProps {
  title: string;
  children: React.ReactNode;

  error?: string;
  loading?: boolean;

  submitLabel: string;
  onSubmit: () => void;

  secondaryLabel?: string;
  onSecondary?: () => void;
}

const AuthFormFrame: React.FC<AuthFormFrameProps> = ({
  title,
  children,
  error,
  loading,
  submitLabel,
  onSubmit,
  secondaryLabel,
  onSecondary,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Title */}
      <Typography
        variant={isMobile ? "h6" : "h5"}
        sx={{ fontWeight: 600, textAlign: "center" }}
      >
        {title}
      </Typography>

      {/* Form fields */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {children}
      </Box>

      {/* Error */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Submit button */}
      <Button
        variant="contained"
        fullWidth
        disabled={loading}
        onClick={onSubmit}
      >
        {loading ? <CircularProgress size={22} /> : submitLabel}
      </Button>

      {/* Secondary button */}
      {secondaryLabel && onSecondary && (
        <Button
          variant="outlined"
          fullWidth
          onClick={onSecondary}
          sx={{ textTransform: "none" }}
        >
          {secondaryLabel}
        </Button>
      )}
    </Box>
  );
};

export default AuthFormFrame;
