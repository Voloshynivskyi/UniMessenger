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
  const media = message.media;

  if (!message || !media) return null;

  // Normalize type for image files
  const mime = media.mimeType || "";
  const rawType = message.type;

  const type: UnifiedTelegramMessage["type"] =
    rawType === "file" && mime.startsWith("image/") ? "photo" : rawType;

  /* ------------------------------------------------------------
     Local state
  ------------------------------------------------------------ */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<"image" | "video" | null>(null);

  /* ------------------------------------------------------------
     Decide source for display
  ------------------------------------------------------------ */
  const hasLocalPreview =
    typeof media.localPreviewUrl === "string" &&
    media.localPreviewUrl.length > 0;

  const realMessageId =
    !message.tempId && !hasLocalPreview ? String(message.messageId) : null;

  const protectedUrl =
    realMessageId != null
      ? `/api/telegram/media/${message.accountId}/${realMessageId}`
      : null;

  /* ------------------------------------------------------------
     Load blob
  ------------------------------------------------------------ */
  useEffect(() => {
    let active = true;

    if (hasLocalPreview) {
      setBlobUrl(media.localPreviewUrl!);
      return () => {
        active = false;
      };
    }

    if (!protectedUrl) return () => void 0;

    const load = async () => {
      try {
        const res = await fetch(protectedUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("media fetch failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (active) setBlobUrl(url);
      } catch {
        if (active) setBlobUrl(null);
      }
    };

    load();

    return () => {
      active = false;
      if (!hasLocalPreview && blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protectedUrl, token, hasLocalPreview]);

  /* ------------------------------------------------------------
     Loading spinner
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     Type Detection
  ------------------------------------------------------------ */
  const isPhoto = type === "photo";
  const isGif = type === "animation";
  const isVideo = type === "video";
  const isAudio = type === "audio" || type === "voice";
  const isSticker = type === "sticker";
  const isVideoNote = type === "video_note" || media.isRoundVideo === true;

  const duration = media.duration ?? 0;
  const waveform = media.waveform ?? null;
  const fileName = media.fileName ?? "File";

  const openViewer = (kind: "image" | "video") => {
    setViewerType(kind);
    setViewerOpen(true);
  };

  /* ------------------------------------------------------------
     VIDEO NOTE
  ------------------------------------------------------------ */
  if (isVideoNote) {
    return (
      <>
        <RoundVideoNote src={blobUrl} />
        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  /* ------------------------------------------------------------
     STICKER
  ------------------------------------------------------------ */
  if (isSticker) {
    return (
      <Box sx={{ maxWidth: 180, p: 1 }}>
        <img
          src={blobUrl}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </Box>
    );
  }

  /* ------------------------------------------------------------
     PHOTO
  ------------------------------------------------------------ */
  if (isPhoto) {
    return (
      <>
        <Box
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: "background.paper",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: 1,
            maxWidth: 360,
            minWidth: 180,
          }}
        >
          <img
            src={blobUrl}
            onClick={() => openViewer("image")}
            style={{
              width: "100%",
              maxHeight: 420,
              objectFit: "cover",
              display: "block",
              cursor: "pointer",
            }}
          />
        </Box>
        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  /* ------------------------------------------------------------
     VIDEO / GIF
  ------------------------------------------------------------ */
  if (isVideo || isGif) {
    return (
      <>
        <Box
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: "background.paper",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: 1,
            maxWidth: 360,
            minWidth: 220,
          }}
        >
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
        </Box>
        <MediaViewerModal
          open={viewerOpen}
          type={viewerType}
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  // Audio or voice message (Telegram style, inside bubble)
  if (isAudio) {
    const seconds = Math.max(1, duration);
    const timeLabel = `${Math.floor(seconds / 60)}:${String(
      Math.floor(seconds % 60)
    ).padStart(2, "0")}`;

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
          flexDirection: "row",
          alignItems: "center",
          gap: 1.2,
        }}
      >
        {/* Play button */}
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            fontSize: 20,
            flexShrink: 0,
          }}
          onClick={togglePlay}
        >
          {isPlaying ? "⏸" : "▶"}
        </Box>

        {/* Waveform */}
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
          {waveform ? (
            <MiniWaveform waveform={waveform} />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: 6,
                bgcolor: "rgba(0,0,0,0.2)",
                borderRadius: 3,
              }}
            />
          )}
        </Box>

        {/* Duration */}
        <Typography
          sx={{ fontSize: 13, opacity: 0.7, minWidth: 34, textAlign: "right" }}
        >
          {timeLabel}
        </Typography>

        <audio
          ref={audioRef}
          src={blobUrl}
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
        />
      </Box>
    );
  }

  // File or unknown type (Telegram style, inside bubble)
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.2,
      }}
    >
      {/* Іконка файлу в синьому кружечку */}
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 16,
            height: 20,
            bgcolor: "#fff",
            borderRadius: 0.5,
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 6,
              height: 6,
              bgcolor: "#e0e0e0",
              borderTopRightRadius: 2,
            }}
          />
        </Box>
      </Box>

      <Box
        component="a"
        href={blobUrl}
        download={fileName}
        target="_blank"
        rel="noreferrer"
        sx={{
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
          color: "inherit",
          maxWidth: 220,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }}
      >
        {fileName}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------
   Mini waveform renderer
------------------------------------------------------------ */
function MiniWaveform({ waveform }: { waveform: number[] }) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return null;
  }

  const normalized = waveform.map((v) => Math.max(0, Math.min(1, v / 255)));
  const TARGET_BARS = 60;
  const step = Math.max(1, Math.floor(normalized.length / TARGET_BARS));
  const reduced = normalized.filter((_, i) => i % step === 0);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: "2px",
        height: 28,
        width: "100%",
      }}
    >
      {reduced.map((v, i) => (
        <Box
          key={i}
          sx={{
            width: "2px",
            height: `${6 + v * 20}px`,
            bgcolor: "rgba(0,0,0,0.38)",
            borderRadius: 1,
          }}
        />
      ))}
    </Box>
  );
}
