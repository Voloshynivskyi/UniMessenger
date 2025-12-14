import React, { useEffect, useRef, useState } from "react";
import { Box, Typography, Divider, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { UnifiedChat } from "../../../../types/unifiedChat.types";
import type { TelegramAuthAccount } from "../../../../api/telegramApi";
import SchedulerChatItem from "./SchedulerChatItem";
import type { ChatTarget } from "./types";
import { buildChatKey } from "../../../inbox/utils/chatUtils";
import type { UnifiedTelegramChat } from "../../../../types/telegram.types";

interface Props {
  account: TelegramAuthAccount;
  chats: UnifiedChat[];
  selectedKeys: Set<string>;
  onToggle: (t: ChatTarget) => void;
  onLoadMore: () => void;
}

export default function SchedulerAccountSection({
  account,
  chats,
  selectedKeys,
  onToggle,
  onLoadMore,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (collapsed || !sentinelRef.current) return;

    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && onLoadMore(),
      { threshold: 0.1 }
    );

    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [collapsed, onLoadMore]);

  const displayName =
    account.username ||
    `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim() ||
    account.phoneNumber ||
    `ID: ${account.telegramId}`;

  return (
    <Box sx={{ px: 1.5, pt: 1.5 }}>
      <Box
        onClick={() => setCollapsed((v) => !v)}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          mb: 0.5,
          userSelect: "none",
        }}
      >
        <Typography noWrap sx={{ flex: 1, fontWeight: 600 }}>
          {displayName}
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
        <Box sx={{ overflowX: "hidden", minWidth: 0 }}>
          {chats.map((chat) => {
            // ⛔ only telegram chats here
            if (chat.platform !== "telegram") return null;
            if (!chat.peerType) return null;

            const tgChat = chat as UnifiedTelegramChat;

            const key = buildChatKey(
              tgChat.platform,
              tgChat.accountId,
              tgChat.chatId
            );

            const requiresHash = tgChat.peerType === "user";
            const hasHash = Boolean(tgChat.accessHash);

            const disabled = requiresHash && !hasHash;

            const target: ChatTarget = {
              targetKey: key,
              platform: "telegram",
              accountId: tgChat.accountId,
              chatId: String(tgChat.chatId),

              peerType: tgChat.peerType,
              accessHash: tgChat.accessHash ?? null,

              title: tgChat.title ?? "Untitled chat",
              subtitle: disabled
                ? "Cannot schedule: accessHash missing"
                : tgChat.lastMessage?.text,

              disabled,
              disabledReason: disabled
                ? "Telegram user requires accessHash"
                : undefined,
            };

            return (
              <SchedulerChatItem
                key={key}
                chat={tgChat}
                selected={selectedKeys.has(key)}
                onToggle={() => onToggle(target)}
                disabled={disabled}
              />
            );
          })}

          <Box ref={sentinelRef} sx={{ height: 1 }} />
        </Box>
      </Collapse>

      <Divider sx={{ mt: 1.5 }} />
    </Box>
  );
}
