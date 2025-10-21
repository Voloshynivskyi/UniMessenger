/**
 * frontend/src/theme.ts
 * Material-UI theme configuration for consistent styling across the app
 */

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    background: {
      default: "#f4f6f8",
      paper: "#ffffff",
    },
  },
});

export default theme;
