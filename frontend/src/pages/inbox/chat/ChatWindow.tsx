import { useEffect, useMemo, useRef } from "react";
import { Box, Typography, Avatar, CircularProgress } from "@mui/material";
import { useUnifiedDialogs } from "../../../context/UnifiedDialogsContext";
import { useMessages } from "../../../context/UnifiedMessagesContext";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { parseChatKey } from "../utils/chatUtils";
import { TypingIndicator } from "../../../components/common/TypingIndicator";
export default function ChatWindow() {
  const { selectedChatKey, chatsByAccount } = useUnifiedDialogs();
  const {
    messagesByChat,
    fetchMessages,
    loadingByChat,
    fetchedByChat,
    clearChatState,
  } = useMessages();
  const { typingByChat } = useUnifiedDialogs();
  const typingUsers = selectedChatKey
    ? typingByChat[selectedChatKey]?.users ?? []
    : [];

  const prevChatKeyRef = useRef<string | null>(null);

  const chat = useMemo(() => {
    if (!selectedChatKey) return null;
    const { accountId } = parseChatKey(selectedChatKey);
    const byAccount = (chatsByAccount as any)[accountId] || {};
    return byAccount[selectedChatKey] || null;
  }, [selectedChatKey, chatsByAccount]);

  const messages = selectedChatKey ? messagesByChat[selectedChatKey] ?? [] : [];

  const isChatLoading = selectedChatKey
    ? !!loadingByChat[selectedChatKey]
    : false;

  useEffect(() => {
    const prevKey = prevChatKeyRef.current;
    if (prevKey && prevKey !== selectedChatKey) {
      clearChatState(prevKey);
    }
    prevChatKeyRef.current = selectedChatKey ?? null;
  }, [selectedChatKey, clearChatState]);

  useEffect(() => {
    if (!selectedChatKey || !chat) return;
    if (fetchedByChat[selectedChatKey]) return;
    if (!chat.peerType || !chat.chatId) return;

    fetchMessages({
      chatKey: selectedChatKey,
      accountId: chat.accountId,
      peerType: chat.peerType,
      peerId: chat.chatId,
      accessHash: chat.accessHash,
    });
  }, [selectedChatKey, chat, fetchedByChat, fetchMessages]);

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

  if (!chat) {
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
          Chat is not available. Try refreshing dialogs.
        </Typography>
      </Box>
    );
  }

  const title = chat.displayName || chat.title || "Chat";
  const subtitle =
    chat.platform === "telegram" ? "Telegram" : chat.platform ?? "";

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: "background.default",
        height: "100%",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          gap: 1.5,
          position: "sticky",
          top: 0,
          zIndex: 2,
          bgcolor: "background.paper",
          backdropFilter: "blur(6px)",
        }}
      >
        <Avatar
          sx={{
            width: 42,
            height: 42,
            bgcolor: "primary.main",
            boxShadow: 1,
          }}
          src={chat.photoUrl || undefined}
        >
          {title?.[0]?.toUpperCase?.()}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {typingUsers.length > 0
              ? `${typingUsers.map((u) => u.name).join(", ")} typing`
              : subtitle}
            {typingUsers.length > 0 && <TypingIndicator />}
          </Typography>
        </Box>

        {/* Тут пізніше буде online / typing */}
        <Box sx={{ minWidth: 80, textAlign: "right" }}></Box>
      </Box>

      {/* BODY */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MessageList
            chatKey={selectedChatKey}
            chat={{
              accountId: chat.accountId,
              peerType: chat.peerType,
              chatId: chat.chatId,
              accessHash: chat.accessHash,
            }}
            messages={messages}
          />

          {isChatLoading && !fetchedByChat[selectedChatKey] && (
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
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: "background.default",
          }}
        >
          <MessageInput
            chatKey={selectedChatKey}
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
