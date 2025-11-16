import { Box, useTheme, useMediaQuery } from "@mui/material";
import React from "react";

const StepContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 2 : 2.5,
        mt: isMobile ? 0.5 : 1.5,
      }}
    >
      {children}
    </Box>
  );
};

export default StepContainer;
