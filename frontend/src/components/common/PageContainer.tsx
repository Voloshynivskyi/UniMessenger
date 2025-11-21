/**
 * Common page container with title and consistent paddings.
 */
import React from "react";
import { Box } from "@mui/material";
import { useMediaQuery, useTheme } from "@mui/material";
type Props = {
  children: React.ReactNode;
};
const PageContainer: React.FC<Props> = ({ children }) => {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const isSm = useMediaQuery(theme.breakpoints.only("sm"));
  const isXs = useMediaQuery(theme.breakpoints.only("xs"));
  return (
    <Box
      sx={{
        gap: 2,
        px: isMdUp ? 1 : isSm ? 1.5 : isXs ? 1.5 : 1,
        py: isMdUp ? 1 : 1.5,
      }}
    >
      {children}
    </Box>
  );
};

export default PageContainer;
