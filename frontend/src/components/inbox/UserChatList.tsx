import React, { useState } from "react";
import ChatList from "./ChatList";
import type { TelegramDialogsPerAccount } from "./hooks/useTelegramDialogs";
import type UnifiedChat from "./types/UnifiedChat";
import { toUnifiedChat } from "./utils/toUnifiedChat";
import { Collapse, ListItemButton, ListItemText, List } from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";

export interface UserChatListProps {
  data: TelegramDialogsPerAccount;
}

const UserChatList: React.FC<UserChatListProps> = ({ data }) => {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  return (
    <List sx={{ width: "100%", bgcolor: "background.paper" }}>
      {/* кнопка з ім’ям користувача */}
      <ListItemButton onClick={handleToggle}>
        <ListItemText primary={data.username || "Unknown name"} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      {/* розкривна частина з чатами */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <ChatList chats={toUnifiedChat(data.dialogs) as UnifiedChat[]} />
      </Collapse>
    </List>
  );
};

export default UserChatList;
