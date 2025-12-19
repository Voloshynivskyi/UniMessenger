// frontend/src/pages/inbox/InboxDiscordChatItem.tsx
import React from "react";
import { ListItemButton, Typography } from "@mui/material";

interface Props {
  title: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  isThread?: boolean;
}

const InboxDiscordChatItem: React.FC<Props> = ({
  title,
  isSelected,
  onClick,
  disabled = false,
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
      <Typography
        variant="body2"
        noWrap
        sx={{
          fontWeight: isThread ? 400 : 500,
          fontSize: isThread ? "0.8rem" : "0.85rem",
        }}
      >
        {title}
      </Typography>
    </ListItemButton>
  );
};

export default InboxDiscordChatItem;
