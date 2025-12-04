import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";

import RecorderWaveform from "./RecorderWaveform";

interface RecorderProps {
  onSend: (file: File, durationMs: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorderUI({ onSend, onCancel }: RecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
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

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const tick = () => {
          if (!analyserRef.current || !startedAtRef.current) return;
          const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(buf);
          setWaveform(Array.from(buf));

          setDurationMs(performance.now() - startedAtRef.current);
          animationRef.current = requestAnimationFrame(tick);
        };

        startedAtRef.current = performance.now();
        tick();

        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (blob.size === 0) {
            onCancel();
            return;
          }

          const file = new File([blob], "voice-message.webm", {
            type: "audio/webm",
          });

          const dur = performance.now() - (startedAtRef.current ?? 0);
          onSend(file, dur);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(200);
      } catch (err) {
        console.error("[VoiceRecorder] init failed", err);
        onCancel();
      }
    }

    init();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current)
        audioContextRef.current.close().catch(() => {});
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      unmounted = true;
    };
  }, [onSend, onCancel]);

  const stopAndSend = () => {
    mediaRecorderRef.current?.requestData();
    mediaRecorderRef.current?.stop();
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `0:${String(s).padStart(2, "0")}`;
  };

  return (
    <Box
      sx={{
        p: 1,
        borderTop: "1px solid #ddd",
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "#f5f5f5",
      }}
    >
      {/* waveform + mic */}
      <MicIcon sx={{ color: "#1976d2" }} />

      <RecorderWaveform waveform={waveform} />

      {/* timer */}
      <Typography sx={{ fontSize: 12, width: 40, textAlign: "right" }}>
        {fmt(durationMs)}
      </Typography>

      {/* RIGHT-BLOCK buttons */}
      <Box sx={{ display: "flex", gap: 1 }}>
        <IconButton onClick={onCancel}>
          <CloseIcon />
        </IconButton>

        <IconButton color="primary" onClick={stopAndSend}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
