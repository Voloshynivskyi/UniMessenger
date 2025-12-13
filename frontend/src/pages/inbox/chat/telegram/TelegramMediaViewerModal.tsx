// frontend/src/pages/inbox/chat/MediaViewerModal.tsx
import { Box, Modal, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect } from "react";

interface Props {
  open: boolean;
  type: "image" | "video" | null;
  src: string | null;
  onClose: () => void;
}

export default function TelegramMediaViewerModal({ open, type, src, onClose }: Props) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          bgcolor: "rgba(0,0,0,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
        onClick={onClose}
      >
        {/* Close button */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            position: "absolute",
            top: 20,
            right: 20,
            color: "white",
            bgcolor: "rgba(255,255,255,0.1)",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.2)",
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* IMAGE */}
        {type === "image" && (
          <Box
            component="img"
            src={src ?? ""}
            onClick={(e) => e.stopPropagation()}
            sx={{
              maxWidth: "95%",
              maxHeight: "95%",
              objectFit: "contain",
              borderRadius: 2,
              boxShadow: 4,
            }}
          />
        )}

        {/* VIDEO */}
        {type === "video" && (
          <Box
            component="video"
            src={src ?? ""}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            sx={{
              maxWidth: "95%",
              maxHeight: "95%",
              borderRadius: 2,
              boxShadow: 4,
              outline: "none",
            }}
          />
        )}
      </Box>
    </Modal>
  );
}
