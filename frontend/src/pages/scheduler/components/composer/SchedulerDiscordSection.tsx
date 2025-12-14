// frontend/src/pages/scheduler/components/composer/SchedulerDiscordSection.tsx
import React, { useState } from "react";
import { Box, Typography, Divider, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SchedulerDiscordChatItem from "./SchedulerDiscordChatItem";
import { buildChatKey } from "../../../inbox/utils/chatUtils";
import type { ChatTarget } from "./types";

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
  selectedKeys: Set<string>;
  onToggle: (t: ChatTarget) => void;
}

const SchedulerDiscordSection: React.FC<Props> = ({
  bot,
  selectedKeys,
  onToggle,
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
        <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>
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
          <Box key={guild.guildId} sx={{ ml: 1, mb: 1, overflowX: "hidden" }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                opacity: 0.75,
                mb: 0.5,
                display: "block",
              }}
              noWrap
            >
              {guild.guildName ?? "Unknown server"}
            </Typography>

            {guild.channels.map((ch) => {
              const channelKey = buildChatKey("discord", bot.botId, ch.chatId);
              const isForum = ch.discordType === "forum";

              const channelTarget: ChatTarget = {
                targetKey: channelKey,
                platform: "discord",
                accountId: bot.botId,
                chatId: String(ch.chatId),
                title: `# ${ch.name}`,
              };

              return (
                <Box key={ch.chatId} sx={{ overflowX: "hidden" }}>
                  <SchedulerDiscordChatItem
                    title={ch.name}
                    isSelected={selectedKeys.has(channelKey)}
                    disabled={isForum}
                    isForum={isForum}
                    onClick={() => {
                      if (isForum) return;
                      onToggle(channelTarget);
                    }}
                  />

                  {ch.threads?.map((t) => {
                    const threadKey = buildChatKey(
                      "discord",
                      bot.botId,
                      t.chatId
                    );

                    const threadTarget: ChatTarget = {
                      targetKey: threadKey,
                      platform: "discord",
                      accountId: bot.botId,
                      chatId: String(t.chatId),
                      title: t.name,
                    };

                    return (
                      <SchedulerDiscordChatItem
                        key={t.chatId}
                        title={t.name}
                        isSelected={selectedKeys.has(threadKey)}
                        isThread
                        onClick={() => onToggle(threadTarget)}
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

export default SchedulerDiscordSection;
