import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";

import InboxPage from "./pages/inbox/InboxPage";
import AccountsPage from "./pages/accounts/AccountsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import LoginPage from "./pages/auth/login/LoginPage";
import RegisterPage from "./pages/auth/register/RegisterPage";
import ProfilePage from "./pages/profile/ProfilePage";
import ProtectedRoute from "./components/ProtectedRoute";

import SchedulerLayout from "./pages/scheduler/SchedulerLayout";
import SchedulerDashboardPage from "./pages/scheduler/pages/SchedulerDashboardPage";
import SchedulerComposerPage from "./pages/scheduler/pages/SchedulerComposerPage";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />

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

        {/* Scheduler module */}
        <Route
          path="scheduler"
          element={
            <ProtectedRoute>
              <SchedulerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<SchedulerDashboardPage />} />
          <Route path="compose" element={<SchedulerComposerPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
