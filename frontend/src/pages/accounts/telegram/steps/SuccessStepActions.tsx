import { Button, Box } from "@mui/material";
import React from "react";

interface SuccessStepActionsProps {
  onClose: () => void;
}

const SuccessStepActions: React.FC<SuccessStepActionsProps> = ({ onClose }) => {
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", width: "100%", mt: 1 }}
    >
      <Button variant="contained" fullWidth onClick={onClose}>
        Close
      </Button>
    </Box>
  );
};

export default SuccessStepActions;
