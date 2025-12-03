// frontend/src/pages/inbox/chat/recorders/VideoNoteRecorderTelegram.tsx

import { Box, IconButton, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";

interface Props {
  onSend: (file: File) => void;
  onCancel: () => void;
}

export default function VideoNoteRecorderTelegram({ onSend, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [chunks, setChunks] = useState<Blob[]>([]);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480 },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const rec = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      recorderRef.current = rec;

      rec.ondataavailable = (e) => setChunks((p) => [...p, e.data]);
      rec.start();

      const interval = setInterval(() => setDuration((d) => d + 1), 1000);
      return () => clearInterval(interval);
    };

    start();
  }, []);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const stopAndSend = () => {
    if (!recorderRef.current) return;

    recorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const file = new File([blob], "video-note.webm", { type: "video/webm" });
      onSend(file);
      cleanup();
    };

    recorderRef.current.stop();
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.8)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <video
        ref={videoRef}
        muted
        style={{
          width: 240,
          height: 240,
          borderRadius: "50%",
          objectFit: "cover",
          background: "#000",
        }}
      />

      <Typography sx={{ color: "white", fontSize: 16 }}>{duration}s</Typography>

      <Box sx={{ display: "flex", gap: 4 }}>
        <IconButton onClick={onCancel}>
          <CloseIcon sx={{ color: "white", fontSize: 32 }} />
        </IconButton>

        <IconButton onClick={stopAndSend}>
          <SendIcon sx={{ color: "white", fontSize: 32 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
