import { Box, Card } from "@mui/material";
import React from "react";
import { useMediaQuery, useTheme } from "@mui/material";
interface SectionCardProps {
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ children }) => {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  return (
    <Card
      sx={{
        maxWidth: "100%",
        width: "100%",
        borderRadius: 2,
        mt: 0,
        backgroundColor: theme.palette.background.paper,
      }}
      elevation={1}
    >
      <Box sx={{ padding: isMdUp ? 2 : 1.5 }}>{children}</Box>
    </Card>
  );
};

export default SectionCard;
