import { Box, Typography } from "@mui/material";
import { useUnifiedDialogs } from "../../../context/UnifiedDialogsContext";
import { parseChatKey } from "../utils/chatUtils";

import TelegramChatView from "./views/TelegramChatView";
import DiscordChatView from "./views/DiscordChatVIew";

export default function ChatWindow() {
  const { selectedChatKey } = useUnifiedDialogs();

  if (!selectedChatKey) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
        }}
      >
        <Typography variant="body1">
          Select a chat to start messaging
        </Typography>
      </Box>
    );
  }

  const { platform } = parseChatKey(selectedChatKey);

  switch (platform) {
    case "telegram":
      return <TelegramChatView chatKey={selectedChatKey} />;

    case "discord":
      return <DiscordChatView chatKey={selectedChatKey} />;

    default:
      return (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body1">
            Unsupported platform: {platform}
          </Typography>
        </Box>
      );
  }
}
