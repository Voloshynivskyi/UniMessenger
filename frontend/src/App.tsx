/**
 * frontend/src/App.tsx
 * Main application component with routing configuration
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";

import InfoPage from "./pages/InfoPage";
import InboxPage from "./pages/InboxPage";
import AccountsPage from "./pages/AccountsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useTelegramSocket } from "./realtime/hooks/useTelegramSocket";
const App: React.FC = () => {
  
  useTelegramSocket(); // for testing Telegram real-time updates

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<InfoPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="inbox"
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="accounts"
          element={
            <ProtectedRoute>
              <AccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
