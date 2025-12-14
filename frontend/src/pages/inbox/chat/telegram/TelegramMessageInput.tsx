// frontend/src/pages/inbox/chat/MessageInput.tsx
import { useState, useRef } from "react";
import { Box, IconButton, TextareaAutosize, Typography } from "@mui/material";

import InsertEmoticonIcon from "@mui/icons-material/InsertEmoticon";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";

import { telegramApi } from "../../../../api/telegramApi";
import { useMessages } from "../../../../context/UnifiedMessagesContext";
import { useUnifiedDialogs } from "../../../../context/UnifiedDialogsContext";
import type { UnifiedTelegramMessage } from "../../../../types/telegram.types";

import EmojiPicker from "./recorders/EmojiPicker";
import VoiceRecorderUI from "./recorders/VoiceRecorderUI";
import VideoNoteRecorderUI from "./recorders/VideoNoteRecorderUI";

interface MessageInputProps {
  chatKey: string;
  accountId: string;
  peerType: "user" | "chat" | "channel";
  peerId: string | number;
  accessHash?: string | number | bigint | null;
}

type RecorderMode = "voice" | "video" | null;

export default function TelegramMessageInput({
  chatKey,
  accountId,
  peerType,
  peerId,
  accessHash,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [recorderMode, setRecorderMode] = useState<RecorderMode>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { addOrUpdateMessage } = useMessages();
  const { applyOptimisticOutgoing } = useUnifiedDialogs();

  // HELPERS

  const makeBaseOptimistic = (
    partial: Partial<UnifiedTelegramMessage>
  ): UnifiedTelegramMessage => {
    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    return {
      platform: "telegram",
      accountId,
      chatId: String(peerId),

      messageId: String(tempId),
      tempId,
      status: "pending",

      date: nowIso,
      from: { id: "me", name: "Me" },
      isOutgoing: true,

      type: "text",
      text: "",
      media: null,

      ...partial,
    } as UnifiedTelegramMessage;
  };

  const determineFileMessageType = (
    file: File
  ): UnifiedTelegramMessage["type"] => {
    if (file.type.startsWith("image/")) return "photo";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "file";
  };

  // TEXT / FILE SEND

  const sendTextOrFile = async () => {
    const trimmed = text.trim();
    const file = attachedFile ?? undefined;

    const hasText = trimmed.length > 0;
    const hasFile = !!file;

    if (!hasText && !hasFile) return;

    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    let msgType: UnifiedTelegramMessage["type"] = "text";
    let media: UnifiedTelegramMessage["media"] = null;

    if (file) {
      msgType = determineFileMessageType(file);
      media = {
        localPreviewUrl: URL.createObjectURL(file),
        mimeType: file.type,
        fileName: file.name,
        size: file.size,
        isRoundVideo: false,
      };
    }

    const optimistic: UnifiedTelegramMessage = {
      platform: "telegram",
      accountId,
      chatId: String(peerId),

      messageId: String(tempId),
      tempId,
      status: "pending",

      text: trimmed,
      type: file ? msgType : "text",
      media,
      date: nowIso,
      from: { id: "me", name: "Me" },
      isOutgoing: true,
    };

    addOrUpdateMessage(chatKey, optimistic);
    applyOptimisticOutgoing(chatKey, optimistic);

    setText("");
    setAttachedFile(null);

    try {
      await telegramApi.sendMessage({
        accountId,
        peerType,
        peerId,
        accessHash,
        text: trimmed,
        file,
        mediaKind: file ? "file" : undefined,
        tempId,
      });
    } catch (err) {
      console.error("[MessageInput] sendTextOrFile failed:", err);
    }
  };

  // VOICE SEND

  const handleVoiceSend = async (file: File, durationMs: number) => {
    setRecorderMode(null);

    const tempId = Date.now();
    const nowIso = new Date().toISOString();
    const durationSec = Math.max(1, Math.round(durationMs / 1000));

    const optimistic = makeBaseOptimistic({
      messageId: String(tempId),
      tempId,
      status: "pending",
      type: "voice",
      text: "",
      media: {
        localPreviewUrl: URL.createObjectURL(file),
        mimeType: file.type,
        fileName: file.name,
        size: file.size,
        duration: durationSec,
        // waveform will be pulled from real update
      },
      date: nowIso,
    });

    addOrUpdateMessage(chatKey, optimistic);
    applyOptimisticOutgoing(chatKey, optimistic);

    try {
      await telegramApi.sendMessage({
        accountId,
        peerType,
        peerId,
        accessHash,
        text: "",
        file,
        mediaKind: "voice",
        tempId,
      });
    } catch (err: any) {
      console.error("[MessageInput] handleVoiceSend failed:", err);
      if (err?.response?.data) {
        console.log("[MessageInput] backend error payload:", err.response.data);
      }
    }
  };

  // VIDEO NOTE SEND

  const handleVideoNoteSend = async (file: File) => {
    setRecorderMode(null);

    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    const optimistic = makeBaseOptimistic({
      messageId: String(tempId),
      tempId,
      status: "pending",
      type: "video_note",
      text: "",
      media: {
        localPreviewUrl: URL.createObjectURL(file),
        mimeType: file.type,
        fileName: file.name,
        size: file.size,
        isRoundVideo: true,
      },
      date: nowIso,
    });

    addOrUpdateMessage(chatKey, optimistic);
    applyOptimisticOutgoing(chatKey, optimistic);

    try {
      await telegramApi.sendMessage({
        accountId,
        peerType,
        peerId,
        accessHash,
        text: "",
        file,
        mediaKind: "video_note",
        tempId,
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[MessageInput] handleVoiceSend failed:", err);

      if (err?.response?.data) {
        // eslint-disable-next-line no-console
        console.log("[MessageInput] backend error payload:", err.response.data);
      }
    }
  };

  // FILE PICKER

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    ev.target.value = "";
  };
  // RECORDING UI RENDER
  if (recorderMode === "voice") {
    return (
      <VoiceRecorderUI
        onSend={handleVoiceSend}
        onCancel={() => setRecorderMode(null)}
      />
    );
  }

  if (recorderMode === "video") {
    return (
      <VideoNoteRecorderUI
        onSend={handleVideoNoteSend}
        onCancel={() => setRecorderMode(null)}
      />
    );
  }

  // RENDER: DEFAULT INPUT

  const hasText = text.trim().length > 0;

  return (
    <Box sx={{ position: "relative", p: 1, borderTop: "1px solid #ddd" }}>
      {/* EMOJI PICKER */}
      {showEmoji && (
        <Box
          sx={{
            position: "absolute",
            bottom: "56px",
            left: 12,
            zIndex: 20,
            boxShadow: 3,
          }}
        >
          <EmojiPicker
            onSelect={(emoji) => {
              setText((t) => t + emoji);
            }}
          />
        </Box>
      )}

      {/* Прикріплений файл */}
      {attachedFile && (
        <Box
          sx={{
            mb: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            bgcolor: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              maxWidth: 260,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            📎 {attachedFile.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setAttachedFile(null)}
            sx={{ ml: "auto" }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {/* Emoji */}
        <IconButton onClick={() => setShowEmoji((s) => !s)}>
          <InsertEmoticonIcon />
        </IconButton>

        {/* Attach */}
        <IconButton onClick={() => fileInputRef.current?.click()}>
          <AttachFileIcon />
        </IconButton>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Text area */}
        <TextareaAutosize
          minRows={1}
          maxRows={6}
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendTextOrFile();
            }
          }}
          style={{
            flexGrow: 1,
            fontSize: "14px",
            lineHeight: "18px",
            padding: "8px 12px",
            borderRadius: "12px",
            border: "1px solid #ccc",
            resize: "none",
            outline: "none",
          }}
        />

        {/* Voice / Send */}
        {!hasText && !attachedFile ? (
          <IconButton color="primary" onClick={() => setRecorderMode("voice")}>
            <MicIcon />
          </IconButton>
        ) : (
          <IconButton color="primary" onClick={sendTextOrFile}>
            <SendIcon />
          </IconButton>
        )}

        {/* Video note */}
        <IconButton color="primary" onClick={() => setRecorderMode("video")}>
          <CameraAltIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
