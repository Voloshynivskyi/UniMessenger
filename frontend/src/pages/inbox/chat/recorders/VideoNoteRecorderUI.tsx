// frontend/src/pages/inbox/chat/recorders/VideoNoteRecorderUI.tsx

import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";

interface RecorderProps {
  onSend: (file: File) => void;
  onCancel: () => void;
}

export default function VideoNoteRecorderUI({
  onSend,
  onCancel,
}: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [durationMs, setDurationMs] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 480,
            height: 480,
          },
          audio: {
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (unmounted) return;
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.muted = true;
        video.volume = 0;
        (video as any).playsInline = true;

        await video.play().catch(() => {});

        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

        const recorder = new MediaRecorder(stream, { mimeType: mime });
        recorderRef.current = recorder;

        chunksRef.current = [];
        recorder.ondataavailable = (e) =>
          e.data.size > 0 && chunksRef.current.push(e.data);

        startedAt.current = performance.now();

        const tick = () => {
          if (unmounted || !startedAt.current) return;
          setDurationMs(performance.now() - startedAt.current);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          if (blob.size === 0) {
            onCancel();
            return;
          }
          const file = new File([blob], "video-note.webm", {
            type: "video/webm",
          });
          onSend(file);
        };

        recorder.start(200);
      } catch (err) {
        console.error("[VideoNoteRecorder] init failed", err);
        onCancel();
      }
    }

    init();

    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      unmounted = true;
    };
  }, [onSend, onCancel]);

  const stop = () => {
    recorderRef.current?.requestData();
    recorderRef.current?.stop();
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `0:${String(s).padStart(2, "0")}`;
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          color: "white",
        }}
      >
        <IconButton onClick={onCancel} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
        <Typography sx={{ fontSize: 30 }}>{fmt(durationMs)}</Typography>
      </Box>

      <Box
        sx={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid rgba(255,255,255,0.7)",
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Box>

      <Box sx={{ position: "absolute", bottom: 32, gap: 4, display: "flex" }}>
        <IconButton
          onClick={stop}
          sx={{ bgcolor: "white", width: 64, height: 64 }}
        >
          <CheckIcon sx={{ fontSize: 32 }} />
        </IconButton>

        <IconButton
          onClick={onCancel}
          sx={{ bgcolor: "red", width: 64, height: 64 }}
        >
          <CloseIcon sx={{ fontSize: 32 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
