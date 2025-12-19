// frontend/src/pages/inbox/chat/views/TelegramChatView.tsx

import { useEffect, useMemo, useRef } from "react";
import { Box, Typography, Avatar, CircularProgress } from "@mui/material";

import { useUnifiedDialogs } from "../../../../context/UnifiedDialogsContext";
import { useMessages } from "../../../../context/UnifiedMessagesContext";

import TelegramMessageList from "../telegram/TelegramMessageList";
import TelegramMessageInput from "../telegram/TelegramMessageInput";

import { parseChatKey } from "../../utils/chatUtils";
import { TypingIndicator } from "../../../../components/common/TypingIndicator";

interface Props {
  chatKey: string;
}

export default function TelegramChatView({ chatKey }: Props) {
  const { chatsByAccount, typingByChat } = useUnifiedDialogs();
  const {
    messagesByChat,
    fetchMessages,
    loadingByChat,
    fetchedByChat,
    clearChatState,
  } = useMessages();

  const prevChatKeyRef = useRef<string | null>(null);

  /* ---------------- Resolve chat ---------------- */
  const chat = useMemo(() => {
    const { accountId } = parseChatKey(chatKey);
    const byAccount = (chatsByAccount as any)[accountId] || {};
    return byAccount[chatKey] || null;
  }, [chatKey, chatsByAccount]);

  const messages = messagesByChat[chatKey] ?? [];
  const isChatLoading = !!loadingByChat[chatKey];
  const typingUsers = typingByChat[chatKey]?.users ?? [];

  /* ---------------- Cleanup on switch ---------------- */
  useEffect(() => {
    const prev = prevChatKeyRef.current;
    if (prev && prev !== chatKey) clearChatState(prev);
    prevChatKeyRef.current = chatKey;
  }, [chatKey, clearChatState]);

  /* ---------------- Initial fetch ---------------- */
  useEffect(() => {
    if (!chat) return;
    if (fetchedByChat[chatKey]) return;
    if (!chat.peerType || !chat.chatId) return;

    fetchMessages({
      chatKey,
      accountId: chat.accountId,
      peerType: chat.peerType,
      peerId: chat.chatId,
      accessHash: chat.accessHash,
    });
  }, [chat, chatKey, fetchedByChat, fetchMessages]);

  if (!chat) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary">
          Chat is not available. Try refreshing dialogs.
        </Typography>
      </Box>
    );
  }

  const title = chat.displayName || chat.title || "Chat";

  /* ================= RENDER ================= */
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: "background.default",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: "background.paper",
        }}
      >
        <Avatar sx={{ width: 42, height: 42 }} src={chat.photoUrl || undefined}>
          {title[0]?.toUpperCase()}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {typingUsers.length
              ? `${typingUsers.map((u) => u.name).join(", ")} typing`
              : "Telegram"}
            {typingUsers.length > 0 && <TypingIndicator />}
          </Typography>
        </Box>
      </Box>

      {/* BODY + INPUT WRAPPER */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* MESSAGE LIST WRAPPER */}
        <Box
          sx={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TelegramMessageList
            chatKey={chatKey}
            chat={{
              accountId: chat.accountId,
              peerType: chat.peerType,
              chatId: chat.chatId,
              accessHash: chat.accessHash,
            }}
            messages={messages}
          />

          {isChatLoading && !fetchedByChat[chatKey] && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
                opacity: 0.85,
              }}
            >
              <CircularProgress />
            </Box>
          )}
        </Box>

        {/* INPUT */}
        <Box
          sx={{
            borderTop: (t) => `1px solid ${t.palette.divider}`,
            bgcolor: "background.default",
          }}
        >
          <TelegramMessageInput
            chatKey={chatKey}
            accountId={chat.accountId}
            peerType={chat.peerType}
            peerId={chat.chatId}
            accessHash={chat.accessHash}
          />
        </Box>
      </Box>
    </Box>
  );
}
