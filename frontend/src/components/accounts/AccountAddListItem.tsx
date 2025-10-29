/**
 * frontend/src/components/accounts/AddAccountListItem.tsx
 * Minimalistic "Add Account" list entry matching list style
 */

import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

interface AddAccountListItemProps {
  onClick: () => void;
  refresh?: () => void;
  label?: string;
}

const AddAccountListItem: React.FC<AddAccountListItemProps> = ({
  onClick,
  label = "Add Telegram account",
}) => {
  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={onClick}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <AddIcon color="primary" />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography sx={{ fontWeight: 500, color: "primary.main" }}>
                {label}
              </Typography>
            }
          />
        </ListItemButton>
      </ListItem>
      <Divider component="li" />
    </>
  );
};

export default AddAccountListItem;
