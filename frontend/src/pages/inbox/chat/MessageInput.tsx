import { useState, useRef } from "react";
import { Box, IconButton, TextField, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";

import { telegramApi } from "../../../api/telegramApi";
import { useMessages } from "../../../context/UnifiedMessagesContext";
import { useUnifiedDialogs } from "../../../context/UnifiedDialogsContext";

import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

export default function MessageInput({
  chatKey,
  accountId,
  peerType,
  peerId,
  accessHash,
}: {
  chatKey: string;
  accountId: string;
  peerType: "user" | "chat" | "channel";
  peerId: string | number;
  accessHash?: string | number | bigint | null;
}) {
  const { addOrUpdateMessage, sendTelegramMessage } = useMessages();
  const { applyOptimisticOutgoing } = useUnifiedDialogs();

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ============================================================
     ADD ATTACHMENT (preview in input)
     ============================================================ */
  const handleFileSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    setAttachments((prev) => [...prev, file]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  /* ============================================================
     SEND MESSAGE WITH OR WITHOUT FILES
     ============================================================ */
  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;

    // CASE 1 → ONLY TEXT
    if (attachments.length === 0) {
      const tempId = Date.now();
      const nowISO = new Date().toISOString();

      const optimistic: UnifiedTelegramMessage = {
        platform: "telegram",
        accountId,
        chatId: String(peerId),

        messageId: String(tempId),
        tempId,

        text,
        date: nowISO,
        isOutgoing: true,

        from: { id: accountId, name: "Me" },
        type: "text",
        status: "pending",
      };

      addOrUpdateMessage(chatKey, optimistic);
      applyOptimisticOutgoing(chatKey, optimistic);

      sendTelegramMessage({
        accountId,
        chatId: String(peerId),
        text,
        tempId,
        peerType,
        accessHash: accessHash != null ? String(accessHash) : undefined,
      });

      setText("");
      return;
    }

    // CASE 2 → THERE ARE FILES (one by one)
    for (const file of attachments) {
      const uploaded = await telegramApi.uploadMedia(
        accountId,
        String(peerId),
        file
      );

      const tempId = Date.now() + Math.random();
      const nowISO = new Date().toISOString();

      const optimistic: UnifiedTelegramMessage = {
        platform: "telegram",
        accountId,
        chatId: String(peerId),

        messageId: String(tempId),
        tempId,

        text: "", // no text for attachments (for now)
        date: nowISO,
        isOutgoing: true,

        from: { id: accountId, name: "Me" },
        type: uploaded.kind,
        status: "pending",

        media: {
          id: "local-" + tempId,
          localPreviewUrl: URL.createObjectURL(file),
        } as any,
      };

      addOrUpdateMessage(chatKey, optimistic);
      applyOptimisticOutgoing(chatKey, optimistic);

      sendTelegramMessage({
        accountId,
        chatId: String(peerId),
        tempId,
        peerType,
        accessHash: accessHash != null ? String(accessHash) : undefined,

        media: {
          fileId: uploaded.fileId,
          type: uploaded.kind,
          mime: uploaded.mime,
          fileName: uploaded.fileName, // random + ext
          originalName: uploaded.originalName, // <-- ВСЕ РІШАЄ
        },
      });
    }

    setAttachments([]);
    setText("");
  };

  /* ============================================================ */

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        p: 1,
        gap: 1,
      }}
    >
      {/* ============================
          ATTACHMENTS PREVIEW
          ============================ */}
      {attachments.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            p: 1,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.05)",
          }}
        >
          {attachments.map((file, index) => {
            const url = URL.createObjectURL(file);
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");

            return (
              <Box
                key={index}
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  position: "relative",
                  overflow: "hidden",
                  bgcolor: "#222",
                }}
              >
                {isImage ? (
                  <img
                    src={url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      color: "white",
                      width: "100%",
                      height: "100%",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      p: 1,
                    }}
                  >
                    {file.name}
                  </Box>
                )}

                {/* remove button */}
                <IconButton
                  size="small"
                  onClick={() => removeAttachment(index)}
                  sx={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    bgcolor: "rgba(0,0,0,0.6)",
                    color: "white",
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ============================
          INPUT + BUTTONS
          ============================ */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />

        <IconButton onClick={() => fileInputRef.current?.click()}>
          <AttachFileIcon />
        </IconButton>

        <TextField
          fullWidth
          size="small"
          placeholder="Write a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          maxRows={6}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <IconButton color="primary" onClick={handleSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
