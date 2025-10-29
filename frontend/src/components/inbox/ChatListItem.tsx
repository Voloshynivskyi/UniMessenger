/**
 * frontend/src/components/chats/ChatListItem.tsx
 * Stylish clickable ListItem for a unified chat (Telegram, Discord, Slack)
 */
import React from "react";
import {
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Divider,
  ListItemButton,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import TelegramIcon from "@mui/icons-material/Telegram";
import ChatIcon from "@mui/icons-material/Chat";
import type UnifiedChat from "./types/UnifiedChat";
import { useState, useEffect } from "react";
export interface ChatListItemProps {
  chat: UnifiedChat;
  onClick?: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onClick }) => {
  const [maxChars, setMaxChars] = useState(60);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setMaxChars(Math.round(width / 30));
    };

    handleResize(); // запустити одразу при завантаженні
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const truncate = (text: string, limit: number) =>
    text.length > limit ? text.slice(0, limit) + "..." : text;

  const truncatedMessage = chat.lastMessage
    ? truncate(chat.lastMessage, maxChars)
    : "";
  const getPlatformIcon = () => {
    switch (chat.platform) {
      case "telegram":
        return <TelegramIcon />;
      case "discord":
        return <ChatIcon sx={{ color: "#5865F2" }} />;
      case "slack":
        return <ChatIcon sx={{ color: "#4A154B" }} />;
      default:
        return <ChatIcon />;
    }
  };
  return (
    <>
      <ListItem
        alignItems="flex-start"
        disablePadding
        secondaryAction={
          chat.unreadCount ? (
            <Chip
              label={`${chat.unreadCount} new`}
              color="primary"
              size="small"
              sx={{ mr: 2, fontSize: "0.7rem" }}
            />
          ) : null
        }
      >
        <ListItemButton onClick={onClick}>
          <ListItemAvatar sx={{ mr: 1 }}>
            <Avatar sx={{ width: 40, height: 40 }}>{getPlatformIcon()}</Avatar>
          </ListItemAvatar>

          <ListItemText
            primary={
              <Typography
                sx={{ fontWeight: 500, fontSize: "1rem", display: "flex" }}
                noWrap
              >
                {chat.title || "Unknown Chat"}
              </Typography>
            }
            secondary={
              <Box
                sx={{ width: "90%", display: "flex", flexDirection: "column" }}
              >
                {chat.lastMessage && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      maxWidth: "80%",
                      overflow: "hidden",
                    }}
                  >
                    {truncatedMessage}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.3 }}
                >
                  {chat.lastMessageDate
                    ? new Date(chat.lastMessageDate).toLocaleString()
                    : ""}
                </Typography>
              </Box>
            }
            slotProps={{
              secondary: { component: "div" },
            }}
          />
        </ListItemButton>
      </ListItem>

      <Divider variant="inset" component="li" />
    </>
  );
};

export default ChatListItem;
