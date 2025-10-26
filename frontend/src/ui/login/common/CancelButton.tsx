import React from "react";
import { Button } from "@mui/material";

interface CancelButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  sx?: object;
}

const CancelButton: React.FC<CancelButtonProps> = ({ onClick, children, sx }) => {
  return (
    <Button onClick={onClick} color="error" variant="contained" fullWidth sx={sx}>
      {children}
    </Button>
  );
};
export default CancelButton;
