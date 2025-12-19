// frontend/src/pages/scheduler/SchedulerLayout.tsx

import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import SchedulerShell from "./components/SchedulerShell";
import { SchedulerProvider } from "../../context/SchedulerContext";
import SchedulerPostDrawer from "./components/SchedulerPostDrawer";

export default function SchedulerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const onCreate = () => {
    if (!location.pathname.endsWith("/compose")) {
      navigate("/scheduler/compose");
    }
  };

  return (
    <SchedulerProvider>
      <SchedulerShell onCreate={onCreate}>
        <Outlet />
      </SchedulerShell>

      <SchedulerPostDrawer />
    </SchedulerProvider>
  );
}
