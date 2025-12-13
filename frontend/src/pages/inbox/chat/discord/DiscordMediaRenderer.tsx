// frontend/src/pages/inbox/chat/discord/DiscordMediaRenderer.tsx
import { Box, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type {
  DiscordMedia,
  UnifiedDiscordMessage,
} from "../../../../types/discord.types";
import DiscordMediaViewerModal from "./DiscordMediaViewerModal";

interface Props {
  message: UnifiedDiscordMessage;
}

/**
 * Discord: media.url вже CDN і доступний напряму.
 * Тому тут НЕ потрібні useMediaBlob / token / protected routes.
 */
export default function DiscordMediaRenderer({ message }: Props) {
  const media = message.media ?? null;

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState<"image" | "video">("image");
  const [viewerSrc, setViewerSrc] = useState<string>("");

  const items = useMemo(() => media ?? [], [media]);

  if (!items.length) return null;

  const openViewer = (type: "image" | "video", src: string) => {
    setViewerType(type);
    setViewerSrc(src);
    setViewerOpen(true);
  };

  const renderOne = (m: DiscordMedia, index: number) => {
    const url = m.url;
    const mime = (m.mimeType ?? "").toLowerCase();
    const fileName = m.fileName ?? "File";

    const isImage =
      mime.startsWith("image/") ||
      /\.(png|jpe?g|webp|bmp|svg)$/i.test(url) ||
      message.type === "photo" ||
      message.type === "gif";

    const isGif =
      mime === "image/gif" || /\.gif$/i.test(url) || message.type === "gif";

    const isVideo =
      mime.startsWith("video/") ||
      /\.(mp4|webm|mov|mkv)$/i.test(url) ||
      message.type === "video";

    // фото/гіф
    if (isImage || isGif) {
      return (
        <Box
          key={`${m.id}-${index}`}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            bgcolor: "rgba(255,255,255,0.04)",
            maxWidth: 360,
            minWidth: 200,
            display: "inline-block",
            cursor: "pointer",
          }}
          onClick={() => openViewer("image", url)}
        >
          <img
            src={url}
            alt={fileName}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              objectFit: "cover",
            }}
          />
        </Box>
      );
    }

    // відео
    if (isVideo) {
      return (
        <Box
          key={`${m.id}-${index}`}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            bgcolor: "rgba(0,0,0,0.4)",
            maxWidth: 360,
            minWidth: 220,
            display: "inline-block",
          }}
        >
          <video
            src={url}
            controls
            preload="metadata"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              cursor: "pointer",
              background: "black",
            }}
            onClick={() => openViewer("video", url)}
          />
        </Box>
      );
    }

    // файл
    return (
      <Box
        key={`${m.id}-${index}`}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.2,
          py: 0.9,
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: 360,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: "rgba(88,101,242,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          📎
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Box
            component="a"
            href={url}
            target="_blank"
            rel="noreferrer"
            sx={{
              display: "block",
              color: "inherit",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              maxWidth: 280,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {fileName}
          </Box>

          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
            {m.mimeType ?? "file"}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((m, i) => renderOne(m, i))}
      </Box>

      <DiscordMediaViewerModal
        open={viewerOpen}
        type={viewerType}
        src={viewerSrc}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
