/**
 * frontend/src/components/Layout/Layout.tsx
 * Main layout component providing header, sidebar, and content area structure
 */

import React from "react";
import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import Header from "./header/Header";
import Sidebar from "./sidebar/Sidebar";
import { useAuth } from "../../context/AuthContext";

const drawerWidth = 240;

const Layout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start" }}>
      <Header />
      {isAuthenticated && <Sidebar drawerWidth={drawerWidth} />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          p: "16px",
          mt: "64px",
          minHeight: "100vh",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
