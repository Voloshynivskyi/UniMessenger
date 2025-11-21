import { useState, type KeyboardEvent, type FormEvent } from "react";
import { Box, IconButton, TextField, InputAdornment } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useMessages } from "../../../context/UnifiedMessagesContext";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  chatKey: string;
  accountId: string;
  peerType: "user" | "chat" | "channel";
  peerId: string | number | bigint;
  accessHash?: string | number | bigint | null;
}

export default function MessageInput({
  chatKey,
  accountId,
  peerType,
  peerId,
  accessHash,
}: Props) {
  const { addOrUpdateMessage } = useMessages();
  const [value, setValue] = useState("");

  const canSend = value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;

    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    const msg: UnifiedTelegramMessage = {
      platform: "telegram",

      accountId,
      chatId: String(peerId),

      /** local temporary id */
      tempId: now,
      messageId: now, // temporary messageId = tempId

      /** status of sending */
      status: "pending",

      text: value,
      date: nowISO,
      isOutgoing: true,

      from: {
        id: accountId,
        name: "You",
      },

      type: "text",
    };

    addOrUpdateMessage(chatKey, msg);
    setValue("");

    // TODO: call backend API to actually send the message
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ px: 1.5, py: 1 }}>
      <TextField
        fullWidth
        multiline
        minRows={1}
        maxRows={4}
        placeholder="Type a message…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 3,
            bgcolor: "background.paper",
            boxShadow: (t) => `0 1px 8px ${t.palette.action.hover}`,
            px: 0.5,
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton size="small">
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                color={canSend ? "primary" : "default"}
                disabled={!canSend}
                type="submit"
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}
