// frontend/src/pages/scheduler/components/composer/SchedulerDiscordChatItem.tsx
import React from "react";
import { ListItemButton, Typography, Box, Checkbox } from "@mui/material";

interface Props {
  title: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  isForum?: boolean;
  isThread?: boolean;
}

const SchedulerDiscordChatItem: React.FC<Props> = ({
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
        pr: 1,
        py: isThread ? 0.45 : 0.75,
        borderRadius: 1,
        opacity: disabled ? 0.5 : 1,
        width: "100%",
        minWidth: 0,
        overflow: "hidden", // ✅ prevent horizontal scroll
        "&.Mui-selected": {
          bgcolor: "primary.light",
          "&:hover": { bgcolor: "primary.light" },
        },
        "&:hover": {
          bgcolor: disabled ? "transparent" : "action.hover",
        },
      }}
    >
      <Checkbox
        checked={isSelected}
        tabIndex={-1}
        disableRipple
        sx={{ p: 0.5, mr: 0.75 }}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: isThread ? 400 : 500,
            fontSize: isThread ? "0.8rem" : "0.85rem",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {isForum ? "🗂" : isThread ? "🧵" : "#"} {title}
        </Typography>
      </Box>
    </ListItemButton>
  );
};

export default SchedulerDiscordChatItem;
