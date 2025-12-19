import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
} from "@mui/material";
import { useDiscordBots } from "../../../context/DiscordBotsContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const DiscordAddBotModal: React.FC<Props> = ({ open, onClose, onComplete }) => {
  const [token, setToken] = useState("");
  const { registerBot } = useDiscordBots();

  const handleAdd = async () => {
    if (!token.trim()) return;
    await registerBot(token.trim());
    setToken("");
    onComplete();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Add Discord Bot
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Bot Token"
            fullWidth
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />

          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!token.trim()}
          >
            Add Bot
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DiscordAddBotModal;
