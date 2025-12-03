// frontend/src/pages/inbox/chat/recorders/VoiceRecorderTelegram.tsx

import { Box, IconButton, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import RecorderWaveform from "./RecorderWaveform";

interface Props {
  onSend: (file: File) => void;
  onCancel: () => void;
}

export default function VoiceRecorderTelegram({ onSend, onCancel }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);

  const [chunks, setChunks] = useState<Blob[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [time, setTime] = useState(0);

  /* --------------------------------------------------------
     START RECORDING IMMEDIATELY
  -------------------------------------------------------- */
  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;

      analyserRef.current = analyser;
      source.connect(analyser);

      const rec = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorderRef.current = rec;

      rec.ondataavailable = (e) => setChunks((p) => [...p, e.data]);
      rec.start();

      timerRef.current = window.setInterval(() => {
        setTime((t) => t + 1);

        const arr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(arr);
        setWaveform(Array.from(arr));
      }, 100);
    };

    start();

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  /* --------------------------------------------------------
     STOP & SEND
  -------------------------------------------------------- */
  const stopAndSend = () => {
    if (!recorderRef.current) return;

    recorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const file = new File([blob], "voice-message.webm", {
        type: "audio/webm",
      });
      onSend(file);
    };

    recorderRef.current.stop();
  };

  /* --------------------------------------------------------
     CANCEL
  -------------------------------------------------------- */
  const cancel = () => {
    recorderRef.current?.stop();
    onCancel();
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 1.5,
        bgcolor: "#f1f5ff",
        borderRadius: 2,
      }}
    >
      <RecorderWaveform waveform={waveform} />

      <Typography sx={{ opacity: 0.6 }}>{time}s</Typography>

      <Box sx={{ marginLeft: "auto", display: "flex", gap: 1 }}>
        <IconButton onClick={cancel}>
          <CloseIcon sx={{ color: "#d32f2f" }} />
        </IconButton>

        <IconButton onClick={stopAndSend} color="primary">
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
