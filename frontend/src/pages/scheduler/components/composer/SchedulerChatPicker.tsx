// frontend/src/pages/scheduler/components/composer/SchedulerChatPicker.tsx

import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useTelegram } from "../../../../context/TelegramAccountContext";
import { useUnifiedDialogs } from "../../../../context/UnifiedDialogsContext";
import SchedulerAccountSection from "./SchedulerAccountSection";
import SchedulerDiscordSection from "./SchedulerDiscordSection";
import type { ChatTarget } from "./types";

interface Props {
  value: ChatTarget[];
  onChange: (v: ChatTarget[]) => void;
}

export default function SchedulerChatPicker({ value, onChange }: Props) {
  const { accounts } = useTelegram();
  const { chatsByAccount, fetchMoreDialogs, discordDialogsByBot } =
    useUnifiedDialogs();

  const selectedKeys = useMemo(
    () => new Set(value.map((v) => v.targetKey)),
    [value]
  );

  const toggle = (t: ChatTarget) => {
    if (selectedKeys.has(t.targetKey)) {
      onChange(value.filter((x) => x.targetKey !== t.targetKey));
    } else {
      onChange([...value, t]);
    }
  };

  if (!accounts || accounts.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography sx={{ opacity: 0.75 }}>
          No Telegram accounts connected.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <Typography sx={{ px: 2, py: 1.5, fontWeight: 800 }}>
        Select chats
      </Typography>

      {/* SCROLL AREA */}
      <Box
        sx={{
          maxHeight: 360, // Fixed height
          overflowY: "auto", // Scroll here
          overflowX: "hidden",
          minWidth: 0,
        }}
      >
        {accounts.map((acc) => (
          <SchedulerAccountSection
            key={acc.accountId}
            account={acc}
            chats={Object.values(chatsByAccount[acc.accountId] || {})}
            selectedKeys={selectedKeys}
            onToggle={toggle}
            onLoadMore={() => fetchMoreDialogs("telegram", acc.accountId)}
          />
        ))}

        {Object.values(discordDialogsByBot).map((bot) => (
          <SchedulerDiscordSection
            key={bot.botId}
            bot={bot}
            selectedKeys={selectedKeys}
            onToggle={toggle}
          />
        ))}
      </Box>
    </Box>
  );
}
