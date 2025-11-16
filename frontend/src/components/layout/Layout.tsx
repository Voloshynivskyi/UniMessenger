// frontend/src/components/layout/Layout.tsx
/**
 * Layout.tsx – Corrected layout with:
 * - sidebar from top to bottom
 * - header offset by sidebar width
 * - resizable sidebar
 * - compact mode support
 */

import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Box, Toolbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Header from "./header/Header";
import Sidebar from "./sidebar/Sidebar";

const FULL_WIDTH = 240;
const COMPACT_WIDTH = 72;
const MIN_WIDTH = 60;
const MAX_WIDTH = 360;

const Layout: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    isDesktop ? true : false
  );
  const [sidebarWidth, setSidebarWidth] = useState(FULL_WIDTH);

  // Mobile collapse behavior
  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
      setSidebarCollapsed(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isDesktop]);

  // ----- RESIZE LOGIC -----
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + delta)
      );
      setSidebarWidth(newWidth);
      setSidebarCollapsed(false); // resizing auto-disables compact
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // effective width
  const effectiveWidth =
    !isDesktop || !sidebarOpen
      ? 0
      : sidebarCollapsed
      ? COMPACT_WIDTH
      : sidebarWidth;

  return (
    <Box sx={{ display: "flex", width: "100%", height: "100vh" }}>
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        fullWidth={FULL_WIDTH}
        compactWidth={COMPACT_WIDTH}
      />

      {/* Resize handle */}
      {isDesktop && sidebarOpen && !sidebarCollapsed && (
        <Box
          onMouseDown={startResize}
          sx={{
            width: 4,
            cursor: "col-resize",
            backgroundColor: "transparent",
            "&:hover": { backgroundColor: theme.palette.action.hover },
          }}
        />
      )}

      {/* Header */}
      <Header
        sidebarWidth={effectiveWidth}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${effectiveWidth}px`,
          pt: "64px",
          overflow: "hidden",
          backgroundColor: theme.palette.background.default,
          transition: "margin-left 0.25s ease",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
