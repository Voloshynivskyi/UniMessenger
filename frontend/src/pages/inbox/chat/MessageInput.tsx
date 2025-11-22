// frontend/src/pages/inbox/chat/MessageInput.tsx
import { useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import { useMessages } from "../../../context/UnifiedMessagesContext";
import { useUnifiedDialogs } from "../../../context/UnifiedDialogsContext";

import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  chatKey: string;
  accountId: string;
  peerType: "user" | "chat" | "channel";
  peerId: string | number;
  accessHash?: string | number | bigint | null;
}

export default function MessageInput({
  chatKey,
  accountId,
  peerType,
  peerId,
  accessHash,
}: Props) {
  const { addOrUpdateMessage, sendTelegramMessage } = useMessages();
  const { applyOptimisticOutgoing } = useUnifiedDialogs();

  const [value, setValue] = useState("");

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;

    const tempId = Date.now(); // simple numeric tempId

    const nowISO = new Date().toISOString();

    const optimistic: UnifiedTelegramMessage = {
      platform: "telegram",
      accountId,
      chatId: String(peerId),
      messageId: tempId, // TEMPORARY — real will replace later
      tempId,
      text,
      date: nowISO,
      isOutgoing: true,
      from: { id: accountId, name: "Me" },
      type: "text",
      status: "pending",
    };

    // push optimistic bubble into chat
    addOrUpdateMessage(chatKey, optimistic);

    // update dialogs sidebar
    applyOptimisticOutgoing(chatKey, optimistic);

    // send message to backend with tempId
    sendTelegramMessage({
      accountId,
      chatId: String(peerId),
      text,
      tempId,
      peerType,
      accessHash: accessHash ?? undefined,
    });

    setValue("");
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "center",
        padding: "8px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <IconButton>
        <AttachFileIcon />
      </IconButton>

      <TextField
        fullWidth
        size="small"
        placeholder="Write a message..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        multiline
        maxRows={6}
        autoComplete="off"
      />

      <IconButton color="primary" onClick={handleSend}>
        <SendIcon />
      </IconButton>
    </Box>
  );
}
