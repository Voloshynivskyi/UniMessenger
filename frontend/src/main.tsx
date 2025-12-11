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
import { TelegramProvider } from "./context/TelegramAccountContext";
import theme from "./theme";
import { RealtimeProvider } from "./context/RealtimeContext";
import { UnifiedDialogsProvider } from "./context/UnifiedDialogsContext";
import { UnifiedMessagesProvider } from "./context/UnifiedMessagesContext";
import { SocketProvider } from "./realtime/SocketProvider";
import { DiscordBotsProvider } from "./context/DiscordBotsContext";

function RootApp() {
  const { token } = useAuth();
  return (
    <RealtimeProvider token={token || ""}>
      <SocketProvider>
        <UnifiedMessagesProvider>
          <UnifiedDialogsProvider>
            <App />
          </UnifiedDialogsProvider>
        </UnifiedMessagesProvider>
      </SocketProvider>
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
            <DiscordBotsProvider>
              <RootApp />
            </DiscordBotsProvider>
          </TelegramProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
