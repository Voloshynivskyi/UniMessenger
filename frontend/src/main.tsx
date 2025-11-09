/**
 * frontend/src/main.tsx
 * Application entry point with React setup, routing, and theme configuration
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { TelegramProvider } from "./context/TelegramContext";
import theme from "./theme";
import { RealtimeProvider } from "./context/RealtimeContext";

function RootApp() {
  const { token } = useAuth();
  return (
    <RealtimeProvider token={token || ""}>
      <App />
    </RealtimeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <TelegramProvider>
            <RootApp />
          </TelegramProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
