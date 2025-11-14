import { Box, Step, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import React from "react";
import StepHeader from "../../_shared/StepHeader";
interface SuccessStepContentProps {
  accountLabel: string;
}

const SuccessStepContent: React.FC<SuccessStepContentProps> = ({
  accountLabel,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        py: 2,
        gap: 2,
      }}
    >
      <CheckCircleIcon
        sx={{
          fontSize: 72,
          color: "success.main",
        }}
      />

      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Account connected!
      </Typography>

      <StepHeader
        title={`Your Telegram account "${accountLabel}" has been successfully added.`}
      />
    </Box>
  );
};

export default SuccessStepContent;
