// frontend/src/pages/inbox/chat/MediaRenderer.tsx

import { Box, Typography } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

import RoundVideoNote from "./RoundVideoNote";
import MediaViewerModal from "./MediaViewerModal";
import LoadingSpinner from "../../../components/common/LoadingSpinner";

interface Props {
  message: UnifiedTelegramMessage;
}

export default function MediaRenderer({ message }: Props) {
  const { token } = useAuth();
  const { media, type } = message;

  if (!media) return null;

  // Always declared hooks (IMPORTANT)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // audio-specific state (must also be declared unconditionally)
  const [isPlaying, setIsPlaying] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<"image" | "video" | null>(null);

  const protectedUrl = `/api/telegram/media/${message.accountId}/${message.messageId}`;

  // === MEDIA FETCH ===
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(protectedUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("fetch failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (active) {
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Media load error:", err);
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [token, protectedUrl]);

  // If blob is not loaded yet
  if (!blobUrl) {
    return (
      <Box
        sx={{
          width: 120,
          height: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LoadingSpinner size={28} />
      </Box>
    );
  }

  const isPhoto = type === "photo";
  const isGif = type === "animation";
  const isVideo = type === "video";
  const isAudio = type === "audio" || type === "voice";
  const isSticker = type === "sticker";
  const isVideoNote = type === "video_note" || media.isRoundVideo;

  const fileName = media.fileName ?? "file";
  const fileSize = media.size;
  const duration = media.duration ?? 0;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "";
    const u = ["B", "KB", "MB"];
    let i = 0;
    let v = bytes;
    while (v > 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(1)} ${u[i]}`;
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${ss}`;
  };

  const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Box
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: 1,
        maxWidth: 360,
        minWidth: 180,
        position: "relative",
      }}
    >
      {children}
    </Box>
  );

  const openViewer = (kind: "image" | "video") => {
    setViewerType(kind);
    setViewerOpen(true);
  };

  // ===========================
  // RENDERING (NO HOOKS BELOW)
  // ===========================

  // VIDEO NOTE
  if (isVideoNote) {
    return (
      <>
        <RoundVideoNote src={blobUrl} />

        {message.text && (
          <Typography
            sx={{ mt: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.text}
          </Typography>
        )}

        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  // STICKER
  if (isSticker) {
    return (
      <>
        <Box sx={{ maxWidth: 200, p: 1 }}>
          <img
            src={blobUrl}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </Box>

        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </>
    );
  }

  // PHOTO
  if (isPhoto) {
    return (
      <>
        <Card>
          <img
            src={blobUrl}
            onClick={() => openViewer("image")}
            style={{
              width: "100%",
              maxHeight: 420,
              objectFit: "cover",
              display: "block",
            }}
          />
        </Card>

        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}

        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  // VIDEO / GIF
  if (isVideo || isGif) {
    return (
      <>
        <Card>
          <video
            src={blobUrl}
            controls
            preload="metadata"
            onClick={() => openViewer("video")}
            style={{
              width: "100%",
              maxHeight: 420,
              background: "black",
              display: "block",
              cursor: "pointer",
            }}
          />
        </Card>

        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}

        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  // AUDIO / VOICE
  if (isAudio) {
    const barWidth = Math.min(220, Math.max(80, duration * 12));

    const togglePlay = () => {
      const a = audioRef.current;
      if (!a) return;

      if (a.paused) {
        a.play();
        setIsPlaying(true);
      } else {
        a.pause();
        setIsPlaying(false);
      }
    };

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 3,
          bgcolor: "background.paper",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: 1,
          maxWidth: 360,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            fontSize: 22,
          }}
          onClick={togglePlay}
        >
          {isPlaying ? "⏸" : "▶"}
        </Box>

        <Box
          sx={{
            width: barWidth,
            height: 32,
            borderRadius: 2,
            bgcolor: "rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            px: 1,
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: 2,
              bgcolor: "rgba(0,0,0,0.25)",
              borderRadius: 1,
            }}
          />
        </Box>

        <Box sx={{ textAlign: "right", minWidth: 50 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {formatDuration(duration)}
          </Typography>
          {fileSize && (
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              {formatBytes(fileSize)}
            </Typography>
          )}
        </Box>

        <audio
          ref={audioRef}
          src={blobUrl}
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
        />
      </Box>
    );
  }

  // FILE
  return (
    <Card>
      <Box sx={{ p: 1.25 }}>
        <a
          href={blobUrl}
          download={fileName}
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          📎 {fileName}
        </a>

        {message.text && (
          <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
