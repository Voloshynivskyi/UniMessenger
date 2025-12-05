// frontend/src/pages/inbox/chat/MediaRenderer.tsx

import { Box, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";
import Skeleton from "@mui/material/Skeleton";

import RoundVideoNote from "./RoundVideoNote";
import MediaViewerModal from "./MediaViewerModal";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useMediaBlob } from "../../../hooks/useMediaBlob";
import MessageTimestamp from "./MessageTimestamp";

interface Props {
  message: UnifiedTelegramMessage;
  showTimestampOverlay?: boolean;
}

export default function MediaRenderer({
  message,
  showTimestampOverlay = true,
}: Props) {
  const { token } = useAuth();
  const media = message.media;

  if (!message || !media) return null;

  // Normalize type
  const mime = media.mimeType || "";
  const rawType = message.type;

  const type: UnifiedTelegramMessage["type"] =
    rawType === "file" && mime.startsWith("image/") ? "photo" : rawType;

  /* ------------------------------------------------------------
     HOOKS MUST ALWAYS REMAIN FIRST BEFORE ANY CONDITIONAL LOGIC
  ------------------------------------------------------------ */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<"image" | "video" | null>(null);
  const [musicProgress, setMusicProgress] = useState(0);

  /* ------------------------------------------------------------
     Compute blob URL
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

  const { blobUrl, loading } = useMediaBlob({
    token: token || undefined,
    previewUrl: hasLocalPreview ? media.localPreviewUrl! : null,
    realUrl: protectedUrl,
  });

  /* ------------------------------------------------------------
     TYPE DETECTION (must be defined BEFORE loader uses them)
  ------------------------------------------------------------ */
  const isPhoto = type === "photo";
  const isGif = type === "animation";
  const isVideo = type === "video";
  const isSticker = type === "sticker";
  const isVideoNote = type === "video_note" || media.isRoundVideo === true;

  const isVoiceMessage =
    message.type === "voice" ||
    media.isVoice === true ||
    (Array.isArray(media.waveform) && media.waveform.length > 0);

  const isMusicAudio =
    !isVoiceMessage && media.mimeType?.startsWith("audio/") && media.fileName;

  const duration = media.duration ?? 0;
  const waveform = media.waveform ?? null;
  const fileName = media.fileName ?? "File";

  // All large visual media
  const isVisualMedia = isPhoto || isVideo || isGif || isSticker || isVideoNote;

  /* ------------------------------------------------------------
     RESERVED HEIGHT CALCULATION FOR LAYOUT STABILITY
     Prevents scroll jumps while media is loading
  ------------------------------------------------------------ */
  const aspectRatio =
    media.width && media.height && media.width > 0 && media.height > 0
      ? media.height / media.width
      : isVideoNote
      ? 1
      : 3 / 4;

  const baseWidth = 240;
  let reservedHeight = Math.round(baseWidth * aspectRatio);

  if (reservedHeight < 180) reservedHeight = 180;
  if (reservedHeight > 420) reservedHeight = 420;

  /* ------------------------------------------------------------
     TIMESTAMP FORMATTER
  ------------------------------------------------------------ */
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  /* ------------------------------------------------------------
     TIMESTAMP OVERLAY FOR MEDIA
  ------------------------------------------------------------ */
  const renderOverlayTimestamp = () => {
    if (!showTimestampOverlay) return null;
    return (
      <Box
        sx={{
          position: "absolute",
          right: 8,
          bottom: 8,
          px: 0.9,
          py: 0.3,
          borderRadius: 999,
          bgcolor: "rgba(0,0,0,0.45)",
          color: "white",
          fontSize: "11px",
          backdropFilter: "blur(2px)",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {formatTime(message.date)}
      </Box>
    );
  };

  /* ------------------------------------------------------------
     LOADER — MUST MATCH FINAL MEDIA SIZE
     This prevents scroll jumps when media loads
  ------------------------------------------------------------ */
  if (loading || !blobUrl) {
    // --- Large animated skeleton placeholder for visual media ---
    if (isVisualMedia) {
      return (
        <Box
          sx={{
            position: "relative",
            display: "inline-block",
            width: isVideoNote ? 260 : 360, // always large width
            height: isVideoNote ? 260 : 420, // always large height (fixed for stability)
            borderRadius: isVideoNote ? "50%" : 3, // keep round shape for video notes
            overflow: "hidden",
            bgcolor: "rgba(255,255,255,0.08)",
          }}
        >
          {/* Modern shimmering skeleton */}
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              width: "100%",
              height: "100%",
              borderRadius: "inherit",
              bgcolor: "rgba(22, 18, 18, 0.2)", // better contrast for dark mode
              "& .MuiSkeleton-wave": {
                animationDuration: "1.2s",
              },
            }}
          />
        </Box>
      );
    }

    // --- Smaller skeleton for audio/file ---
    return (
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{
          width: 300,
          height: 48,
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.1)",
          "& .MuiSkeleton-wave": {
            animationDuration: "1.2s",
          },
        }}
      />
    );
  }

  /* ------------------------------------------------------------
     VIDEO NOTE
  ------------------------------------------------------------ */
  if (isVideoNote) {
    return (
      <>
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <RoundVideoNote src={blobUrl} />
          {renderOverlayTimestamp()}
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
     STICKER
  ------------------------------------------------------------ */
  if (isSticker) {
    return (
      <Box
        sx={{
          maxWidth: 180,
          p: 1,
          position: "relative",
          display: "inline-block",
        }}
      >
        <img
          src={blobUrl}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        {renderOverlayTimestamp()}
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
            minHeight: reservedHeight,
            position: "relative",
            display: "inline-block",
          }}
        >
          <img
            src={blobUrl}
            onClick={() => {
              setViewerType("image");
              setViewerOpen(true);
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              cursor: "pointer",
            }}
          />
          {renderOverlayTimestamp()}
        </Box>

        <MediaViewerModal
          open={viewerOpen}
          type="image"
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }
  /* ------------------------------------------------------------
     GIF (render as real GIF image, not a video)
  ------------------------------------------------------------ */
  if (isGif) {
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
            position: "relative",
            display: "inline-block",
          }}
        >
          <img
            src={blobUrl}
            alt="GIF"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              cursor: "pointer",
            }}
            onClick={() => {
              setViewerType("image");
              setViewerOpen(true);
            }}
          />

          {renderOverlayTimestamp()}
        </Box>

        <MediaViewerModal
          open={viewerOpen}
          type="image"
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }
  /* ------------------------------------------------------------
     VIDEO
  ------------------------------------------------------------ */
  if (isVideo) {
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
            minHeight: reservedHeight,
            position: "relative",
            display: "inline-block",
          }}
        >
          <video
            src={blobUrl}
            controls
            preload="metadata"
            onClick={() => {
              setViewerType("video");
              setViewerOpen(true);
            }}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              background: "black",
              cursor: "pointer",
            }}
          />
          {renderOverlayTimestamp()}
        </Box>

        <MediaViewerModal
          open={viewerOpen}
          type="video"
          src={blobUrl}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  /* ------------------------------------------------------------
     MUSIC AUDIO
  ------------------------------------------------------------ */
  if (isMusicAudio) {
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

    const onTimeUpdate = () => {
      const a = audioRef.current;
      if (!a || !a.duration) return;
      setMusicProgress(a.currentTime / a.duration);
    };

    const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const a = audioRef.current;
      if (!a || !a.duration) return;
      const val = Number(e.target.value);
      a.currentTime = val * a.duration;
      setMusicProgress(val);
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            opacity: 0.7,
            maxWidth: 240,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fileName}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
            }}
            onClick={togglePlay}
          >
            {isPlaying ? "⏸" : "▶"}
          </Box>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={musicProgress}
            onChange={onSeek}
            style={{ width: "100%", cursor: "pointer" }}
          />

          <Typography sx={{ fontSize: 13, opacity: 0.7 }}>
            {timeLabel}
          </Typography>

          <MessageTimestamp date={message.date} />

          <audio
            ref={audioRef}
            src={blobUrl}
            preload="metadata"
            onTimeUpdate={onTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
        </Box>
      </Box>
    );
  }

  /* ------------------------------------------------------------
     VOICE MESSAGE
  ------------------------------------------------------------ */
  if (isVoiceMessage) {
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
          }}
          onClick={togglePlay}
        >
          {isPlaying ? "⏸" : "▶"}
        </Box>

        <Box sx={{ flexGrow: 1 }}>
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

        <Typography sx={{ fontSize: 13, opacity: 0.7 }}>{timeLabel}</Typography>

        <MessageTimestamp date={message.date} />

        <audio
          ref={audioRef}
          src={blobUrl}
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
        />
      </Box>
    );
  }

  /* ------------------------------------------------------------
     FILE
  ------------------------------------------------------------ */
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box
          component="a"
          href={blobUrl}
          download={fileName}
          target="_blank"
          rel="noreferrer"
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: "inherit",
            textDecoration: "none",
            maxWidth: 220,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {fileName}
        </Box>

        <MessageTimestamp date={message.date} />
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------
   Mini waveform component
------------------------------------------------------------ */
function MiniWaveform({ waveform }: { waveform: number[] }) {
  if (!waveform || waveform.length === 0) return null;

  const normalized = waveform.map((v) => Math.max(0, Math.min(1, v / 255)));
  const TARGET = 60;
  const step = Math.max(1, Math.floor(normalized.length / TARGET));
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
            width: 2,
            height: `${6 + v * 20}px`,
            bgcolor: "rgba(0,0,0,0.38)",
            borderRadius: 1,
          }}
        />
      ))}
    </Box>
  );
}
