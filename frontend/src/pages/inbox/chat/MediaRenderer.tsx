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

  // ХУКИ — завжди зверху, без умов
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<"image" | "video" | null>(null);

  // Якщо медіа немає — нічого не рендеримо
  if (!media) return null;
  console.log("[MediaRenderer] message", {
    id: message.messageId,
    tempId: message.tempId,
    type: message.type,
    hasMedia: !!media,
    hasLocalPreview: (media as any)?.localPreviewUrl,
  });

  // ------------- КЛЮЧОВА ЛОГІКА ДЖЕРЕЛА БЛОБУ ------------- //

  // 1) Якщо це оптимістичне повідомлення з локальним preview → використовуємо його
  const hasLocalPreview =
    typeof (media as any).localPreviewUrl === "string" &&
    (media as any).localPreviewUrl.length > 0;

  // 2) Якщо є реальний messageId (без tempId і без localPreview) → можна тягнути з бекенда
  const realMessageId =
    !message.tempId && !hasLocalPreview && message.messageId
      ? String(message.messageId)
      : null;

  const protectedUrl =
    realMessageId != null
      ? `/api/telegram/media/${message.accountId}/${realMessageId}`
      : null;

  // === MEDIA FETCH / ВИБІР ДЖЕРЕЛА ===
  useEffect(() => {
    let active = true;

    // Випадок 1: локальний preview (оптимістичний кейс) — БЕКЕНД НЕ ЧІПАЄМО
    if (hasLocalPreview) {
      const localUrl = (media as any).localPreviewUrl as string;
      setBlobUrl(localUrl);
      setIsLoading(false);

      return () => {
        active = false;
        // localPreviewUrl створювався в MessageInput через URL.createObjectURL
        // і його треба буде звільнити там, коли меседж зникне, а не тут
      };
    }

    // Випадок 2: немає ні localPreview, ні реального messageId → нічого грузити
    if (!protectedUrl) {
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    // Випадок 3: реальне повідомлення з Telegram → качаємо з бекенда
    const load = async () => {
      try {
        const res = await fetch(protectedUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(
            `[MediaRenderer] fetch failed: ${res.status} ${res.statusText}`
          );
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (active) {
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[MediaRenderer] Media load error:", err);
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (!hasLocalPreview && blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, protectedUrl, hasLocalPreview, media]);

  // Якщо ще нічого не завантажено — показуємо спінер
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

  // --------------------------------------------------------- //
  // Далі — те саме, що в тебе було: визначення типів і рендер //
  // --------------------------------------------------------- //

  const isPhoto = type === "photo";
  const isGif = type === "animation";
  const isVideo = type === "video";
  const isAudio = type === "audio" || type === "voice";
  const isSticker = type === "sticker";
  const isVideoNote = type === "video_note" || (media as any).isRoundVideo;

  const fileName = (media as any).fileName ?? "file";
  const fileSize = (media as any).size;
  const duration = (media as any).duration ?? 0;

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
          <Typography variant="caption" sx={{ opacity: 0.7, mr: 0.5 }}>
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

  // FILE (документи та ін.)
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
