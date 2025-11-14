// frontend/src/pages/accounts/telegram/TelegramAuthModalV2.tsx
/**
 * Universal animated modal container for Telegram Auth flow.
 * Contains NO auth logic, NO step logic.
 * Only UI, layout, animations and slots.
 */

import React from "react";
import { Backdrop, Box, useTheme, useMediaQuery } from "@mui/material";
import { useSpring, animated } from "@react-spring/web";
import AuthModalHeader from "../_shared/AuthModalHeader";
interface TelegramAuthModalProps {
  open: boolean;
  onClose: () => void;

  /** UI slots */
  header?: React.ReactNode;
  content?: React.ReactNode;
  actions?: React.ReactNode;
}

const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  open,
  onClose,
  header,
  content,
  actions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  /** Smooth fade + scale animation */
  const modalStyle = useSpring({
    opacity: open ? 1 : 0,
    transform: open ? "scale(1)" : "scale(0.95)",
    config: { tension: 230, friction: 20 },
  });

  return (
    <Backdrop
      open={open}
      onClick={onClose}
      sx={{
        zIndex: theme.zIndex.modal + 2,
        bgcolor: "rgba(0,0,0,0.4)",
      }}
    >
      <animated.div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        <Box
          sx={{
            width: isMobile ? "90vw" : 420,
            maxWidth: "95vw",
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            boxShadow: theme.shadows[10],
            p: isMobile ? 3 : 4,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {/* Header */}
          {header && <AuthModalHeader title={String(header)} />}

          {/* Content */}
          {content && <Box>{content}</Box>}

          {/* Actions */}
          {actions && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                mt: 1,
              }}
            >
              {actions}
            </Box>
          )}
        </Box>
      </animated.div>
    </Backdrop>
  );
};

export default TelegramAuthModal;
