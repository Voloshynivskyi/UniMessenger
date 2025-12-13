// DiscordChatView.tsx
import { Box, Typography, CircularProgress } from "@mui/material";
import { useEffect, useMemo } from "react";
import { parseChatKey } from "../../utils/chatUtils";
import { useUnifiedDialogs } from "../../../../context/UnifiedDialogsContext";
import { useMessages } from "../../../../context/UnifiedMessagesContext";
import type { UnifiedDiscordMessage } from "../../../../types/discord.types";

import DiscordMessageList from "../discord/DiscordMessageList";
import DiscordMessageInput from "../discord/DiscordMessageInput";

interface Props {
  chatKey: string;
}

export default function DiscordChatView({ chatKey }: Props) {
  const { discordDialogsByBot } = useUnifiedDialogs();
  const { messagesByChat, fetchMessages, fetchedByChat, loadingByChat } =
    useMessages();

  const { accountId: botId, chatId } = parseChatKey(chatKey);

  const { bot, channel, thread } = useMemo(() => {
    const bot = discordDialogsByBot[botId];
    if (!bot) return { bot: null, channel: null, thread: null };

    for (const guild of bot.guilds) {
      for (const ch of guild.channels) {
        // 1️⃣ direct channel match
        if (ch.chatId === chatId) {
          return { bot, channel: ch, thread: null };
        }

        // 2️⃣ thread match
        const foundThread = ch.threads?.find(
          (t: { chatId: string }) => t.chatId === chatId
        );
        if (foundThread) {
          return { bot, channel: ch, thread: foundThread };
        }
      }
    }

    return { bot, channel: null, thread: null };
  }, [discordDialogsByBot, botId, chatId]);

  const discordMessages = useMemo(
    () =>
      (messagesByChat[chatKey] ?? []).filter(
        (m): m is UnifiedDiscordMessage => m.platform === "discord"
      ),
    [messagesByChat, chatKey]
  );

  const isLoading = !!loadingByChat[chatKey];

  useEffect(() => {
    if (!bot || !channel) return;
    if (fetchedByChat[chatKey]) return;

    fetchMessages({
      chatKey,
      platform: "discord",
      accountId: botId,
      chatId,
    } as any);
  }, [chatKey, fetchedByChat, fetchMessages, botId, chatId, bot, channel]);

  if (!bot || !channel) {
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
        <Typography>
          Discord channel is not available. Try refreshing dialogs.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      {/* HEADER */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography fontWeight={700}>#{channel.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          Discord
        </Typography>
      </Box>

      {/* MESSAGES */}
      <DiscordMessageList
        chatKey={chatKey}
        messages={discordMessages}
        accountId={botId}
      />

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {/* INPUT */}
      <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider" }}>
        <DiscordMessageInput chatKey={chatKey} chatId={chatId} />
      </Box>
    </Box>
  );
}
