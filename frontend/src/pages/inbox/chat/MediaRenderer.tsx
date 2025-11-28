import { Box, Typography } from "@mui/material";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface Props {
  message: UnifiedTelegramMessage;
}

export default function MediaRenderer({ message }: Props) {
  const type = message.type;
  const media = message.media;

  if (!media) return null;

  // ✔️ Правильний URL згідно backend router-а
  const fileUrl = `/api/telegram/media/${message.accountId}/${message.messageId}`;

  /* PHOTO */
  if (type === "photo") {
    return (
      <Box>
        <img
          src={fileUrl}
          alt=""
          style={{ maxWidth: "100%", borderRadius: 12 }}
        />
        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </Box>
    );
  }

  /* VIDEO */
  if (type === "video" || type === "animation") {
    return (
      <Box>
        <video
          src={fileUrl}
          controls
          style={{ maxWidth: "100%", borderRadius: 12 }}
        />
        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </Box>
    );
  }

  /* VOICE */
  if (type === "voice" || type === "audio") {
    return (
      <Box>
        <audio controls src={fileUrl} />
        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </Box>
    );
  }

  /* STICKER */
  if (type === "sticker") {
    if (!media.isAnimated) {
      return <img src={fileUrl} alt="sticker" width={140} />;
    }
    return (
      <video
        src={fileUrl}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: 140, borderRadius: 12 }}
      />
    );
  }

  /* VIDEO NOTE */
  if (type === "video_note") {
    return (
      <video
        src={fileUrl}
        controls
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }

  /* FILE */
  if (type === "file") {
    return (
      <Box>
        <a href={fileUrl} download={media.fileName ?? "file"}>
          📎 {media.fileName ?? "Download file"}
        </a>
        {message.text && (
          <Typography sx={{ mt: 0.7, whiteSpace: "pre-wrap" }}>
            {message.text}
          </Typography>
        )}
      </Box>
    );
  }

  return <Typography variant="body2">Unsupported media</Typography>;
}
