import React from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";

const Header: React.FC = () => {
  const buttonWidth = "100px";
  const navigate = useNavigate();
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: "linear-gradient(to right, #1976d2, #2196f3)",
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          noWrap
          component="div"
          onClick={() => navigate("/")}
          sx={{ cursor: "pointer", mr: `calc(80% - ${buttonWidth})` }}
        >
          UniMessenger
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          sx={{ width: buttonWidth }}
          onClick={() => navigate("/login")}
        >
          Login
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
