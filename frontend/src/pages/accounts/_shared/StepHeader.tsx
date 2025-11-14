import { Typography, Box } from "@mui/material";
import React from "react";

interface StepHeaderProps {
  title: string;
  subtitle?: string;
}

const StepHeader: React.FC<StepHeaderProps> = ({ title, subtitle }) => {
  return (
    <Box sx={{ textAlign: "center", mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: subtitle ? 1 : 0 }}>
        {title}
      </Typography>

      {subtitle && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default StepHeader;
