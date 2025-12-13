// InboxDiscordSection.tsx
import React, { useState } from "react";
import { Box, Typography, Divider, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InboxDiscordChatItem from "./InboxDiscordChatItem";
import { buildChatKey } from "./utils/chatUtils";

interface DiscordThread {
  chatId: string;
  name: string;
  discordType: "thread";
  parentId: string;
}

interface DiscordChannel {
  chatId: string;
  name: string;
  discordType: "text" | "forum";
  threads?: DiscordThread[];
}

interface DiscordGuild {
  guildId: string;
  guildName?: string;
  channels: DiscordChannel[];
}

interface DiscordBotDialogs {
  botId: string;
  botUsername?: string | null;
  guilds: DiscordGuild[];
}

interface Props {
  bot: DiscordBotDialogs;
  selectedChatKey: string | null;
  onSelectChat: (key: string) => void;
}

const InboxDiscordSection: React.FC<Props> = ({
  bot,
  selectedChatKey,
  onSelectChat,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ px: 1.5, pt: 1.5 }}>
      {/* BOT HEADER */}
      <Box
        onClick={() => setCollapsed((v) => !v)}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          mb: collapsed ? 1 : 0.5,
          userSelect: "none",
        }}
      >
        <Typography sx={{ flex: 1, fontWeight: 700 }}>
          🤖 {bot.botUsername ?? "Discord bot"}
        </Typography>

        <IconButton
          size="small"
          sx={{
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

      <Collapse in={!collapsed} unmountOnExit>
        {bot.guilds.map((guild) => (
          <Box key={guild.guildId} sx={{ ml: 1, mb: 1 }}>
            {/* GUILD */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                opacity: 0.75,
                mb: 0.5,
                display: "block",
              }}
            >
              {guild.guildName ?? "Unknown server"}
            </Typography>

            {/* CHANNELS */}
            {guild.channels.map((ch) => {
              const channelKey = buildChatKey("discord", bot.botId, ch.chatId);
              const isForum = ch.discordType === "forum";

              return (
                <Box key={ch.chatId}>
                  {/* CHANNEL */}
                  <InboxDiscordChatItem
                    title={ch.name}
                    isSelected={selectedChatKey === channelKey}
                    disabled={isForum}
                    isForum={isForum}
                    onClick={() => {
                      if (isForum) return;
                      onSelectChat(channelKey);
                    }}
                  />

                  {/* THREADS */}
                  {ch.threads?.map((t) => {
                    const threadKey = buildChatKey(
                      "discord",
                      bot.botId,
                      t.chatId
                    );

                    return (
                      <InboxDiscordChatItem
                        key={t.chatId}
                        title={t.name}
                        isSelected={selectedChatKey === threadKey}
                        isThread
                        onClick={() => onSelectChat(threadKey)}
                      />
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        ))}
      </Collapse>

      <Divider sx={{ mt: 1.5 }} />
    </Box>
  );
};

export default InboxDiscordSection;
