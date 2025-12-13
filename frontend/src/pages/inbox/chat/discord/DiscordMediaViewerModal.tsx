// frontend/src/pages/inbox/chat/discord/DiscordMediaViewerModal.tsx
import { Dialog, Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type ViewerType = "image" | "video";

interface Props {
  open: boolean;
  type: ViewerType;
  src: string;
  onClose: () => void;
}

export default function DiscordMediaViewerModal({
  open,
  type,
  src,
  onClose,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "rgba(0,0,0,0.92)",
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
            color: "white",
            bgcolor: "rgba(255,255,255,0.08)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box
          sx={{
            width: "100%",
            height: "calc(100vh - 120px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
          }}
        >
          {type === "image" ? (
            <img
              src={src}
              alt="media"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <video
              src={src}
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
                background: "black",
                borderRadius: 12,
              }}
            />
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
