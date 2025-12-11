import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
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
      <DialogTitle>Add Discord Bot</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Bot Token"
          fullWidth
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button variant="contained" onClick={handleAdd}>
          Add Bot
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DiscordAddBotModal;
