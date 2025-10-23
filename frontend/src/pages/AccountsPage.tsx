import React, { useState } from "react";
import { Box, Typography, IconButton, Paper, Divider } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TelegramAuthModal from "../components/accounts/telegram/TelegramAuthModal";

const AccountsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Box sx={{ p: 0 }}>
      <Paper sx={{ p: "4vh", minWidth: 400, width: "100%", borderRadius: 5 }}>
        <Typography sx={{ mb: "4vh", fontSize: "h5.fontSize" }}>
          Accounts Page
        </Typography>

        <IconButton
          onClick={() => setIsModalOpen(true)}
          sx={{ width: 40, height: 40 }}
        >
          <AddIcon />
        </IconButton>
        <Divider />
        <TelegramAuthModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </Paper>
    </Box>
  );
};

export default AccountsPage;
