/**
 * Layout with fixed Sidebar and placeholder to reserve space in flex layout.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { Box, Toolbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Header from "./header/Header";
import Sidebar from "./sidebar/Sidebar";

const FULL_WIDTH = 240;
const COMPACT_WIDTH = 72;
const APPBAR_HEIGHT = 64;

const Layout: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarOpen(isDesktop);
    if (!isDesktop) setSidebarCollapsed(false);
  }, [isDesktop]);

  const sidebarWidth = useMemo(() => {
    if (!isDesktop) return 0;
    if (!sidebarOpen) return 0;
    return sidebarCollapsed ? COMPACT_WIDTH : FULL_WIDTH;
  }, [isDesktop, sidebarOpen, sidebarCollapsed]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {/* Header always full width */}
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Sidebar (fixed) */}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        appBarHeight={APPBAR_HEIGHT}
        fullWidth={FULL_WIDTH}
        compactWidth={COMPACT_WIDTH}
      />

      {/* Placeholder – reserves sidebar space in flex layout */}
      {isDesktop && (
        <Box
          sx={{
            flexShrink: 0,
            width: `${sidebarWidth}px`,
            transition: "width 0.25s ease-in-out",
          }}
        />
      )}

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: 3,
          backgroundColor: theme.palette.background.default,
          transition: "width 0.25s ease-in-out",
        }}
      >
        {/* Offset for AppBar height */}
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
