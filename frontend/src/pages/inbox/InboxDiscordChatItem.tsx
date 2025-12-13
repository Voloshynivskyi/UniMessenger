// InboxDiscordChatItem.tsx
import React from "react";
import { ListItemButton, Typography, Box } from "@mui/material";

interface Props {
  title: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  isForum?: boolean;
  isThread?: boolean;
}

const InboxDiscordChatItem: React.FC<Props> = ({
  title,
  isSelected,
  onClick,
  disabled = false,
  isForum = false,
  isThread = false,
}) => {
  return (
    <ListItemButton
      onClick={disabled ? undefined : onClick}
      selected={isSelected}
      disabled={disabled}
      sx={{
        pl: isThread ? 4 : 2,
        py: isThread ? 0.5 : 0.8,
        borderRadius: 1,
        opacity: disabled ? 0.5 : 1,

        "&.Mui-selected": {
          bgcolor: "primary.light",
          "&:hover": { bgcolor: "primary.light" },
        },

        "&:hover": {
          bgcolor: disabled ? "transparent" : "action.hover",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: isThread ? 400 : 500,
            fontSize: isThread ? "0.8rem" : "0.85rem",
          }}
        >
          {isForum ? "🗂" : isThread ? "🧵" : "#"} {title}
        </Typography>
      </Box>
    </ListItemButton>
  );
};

export default InboxDiscordChatItem;
