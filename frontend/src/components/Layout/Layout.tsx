import React from "react";
import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import Header from "./header/Header";
import Sidebar from "./sidebar/Sidebar";
import Toolbar from "@mui/material/Toolbar";

const drawerWidth = 240;

const Layout: React.FC = () => {
  return (
    <Box sx={{ display: "flex", contentAlign: "left" }}>
      <Header />
      <Sidebar drawerWidth={drawerWidth} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          p: 0,
          ml: "64px",
          mt: "64px",
          mr: "64px",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
