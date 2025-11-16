import React from "react";
import { Box, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StepContainer from "../../_shared/StepContainer";
import StepHeader from "../../_shared/StepHeader";

interface Props {
  label: string;
}

const SuccessStepContent: React.FC<Props> = ({ label }) => {
  return (
    <StepContainer>
      <StepHeader
        title="Success!"
        subtitle="The account has been added to UniMessenger."
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 2,
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 72, color: "success.main" }} />

        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
    </StepContainer>
  );
};

export default SuccessStepContent;
