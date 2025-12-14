// frontend/src/pages/inbox/chat/discord/DiscordMessageInput.tsx
import { Box, IconButton, TextareaAutosize, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import { useRef, useState } from "react";
import { discordApi } from "../../../../api/discordApi";

export default function DiscordMessageInput({
  chatKey,
  chatId,
}: {
  chatKey: string;
  chatId: string;
}) {
  const [text, setText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // chatKey has format "discord:<botId>:<chatId>"
  // Extract botId using split
  const botId = chatKey.split(":")[1];

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachedFile(f);
    e.target.value = "";
  };

  const send = async () => {
    const trimmed = text.trim();
    const file = attachedFile;

    const hasText = trimmed.length > 0;
    const hasFile = !!file;

    if (!hasText && !hasFile) return;

    // очистимо UI одразу
    setText("");
    setAttachedFile(null);

    try {
      if (file) {
        await discordApi.sendFile(botId, chatId, file, trimmed || undefined);
        return;
      }

      await discordApi.sendText(botId, chatId, trimmed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[DiscordMessageInput] send failed:", err);
    }
  };

  const showSend = text.trim().length > 0 || !!attachedFile;

  return (
    <Box sx={{ p: 1, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Attached file row */}
      {attachedFile && (
        <Box
          sx={{
            mb: 0.8,
            px: 1,
            py: 0.7,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              maxWidth: 280,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              opacity: 0.9,
            }}
          >
            📎 {attachedFile.name}
          </Typography>

          <IconButton
            size="small"
            sx={{ ml: "auto" }}
            onClick={() => setAttachedFile(null)}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
        <IconButton onClick={pickFile}>
          <AttachFileIcon />
        </IconButton>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={onFileChange}
        />

        <TextareaAutosize
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message #channel"
          minRows={1}
          maxRows={6}
          style={{
            flexGrow: 1,
            resize: "none",
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(30,31,34,0.9)",
            color: "#dbdee1",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        <IconButton onClick={send} disabled={!showSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
