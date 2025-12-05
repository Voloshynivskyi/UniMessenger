import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Divider,
  Stack,
  Chip,
  Paper,
  Tooltip,
} from "@mui/material";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import { useTelegram } from "../../context/TelegramAccountContext";

export default function DebugDialog() {
  const {
    chatsByAccount,
    selectedChatKey,
    loading,
    error,
    fetchDialogs,
    fetchMoreDialogs,
    selectChat,
  } = useUnifiedDialogs();

  const { accounts } = useTelegram(); // All Telegram accounts
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );

  const platform = "telegram"; // Can be dynamically selected later

  // When accounts loaded — select first by default
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].accountId);
      fetchDialogs(platform, accounts[0].accountId);
    }
  }, [accounts]);

  // оновлення чатів при зміні акаунта
  useEffect(() => {
    if (selectedAccountId) {
      fetchDialogs(platform, selectedAccountId);
    }
  }, [selectedAccountId]);

  // усі чати для поточного акаунта
  const chatList = selectedAccountId
    ? Object.values(chatsByAccount[selectedAccountId] || {})
    : [];

  const selectedChat = useMemo(
    () => (selectedChatKey ? findChatByKey(selectedChatKey) : null),
    [selectedChatKey, chatsByAccount]
  );

  function findChatByKey(chatKey: string) {
    for (const accId in chatsByAccount) {
      const found = chatsByAccount[accId][chatKey];
      if (found) return found;
    }
    return null;
  }

  return (
    <Box sx={{ p: 4, display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ display: "flex", gap: 1 }}
      >
        🧩 Debug Dialog
      </Typography>

      {/* Controls */}
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          onClick={() =>
            selectedAccountId && fetchDialogs(platform, selectedAccountId)
          }
          disabled={loading || !selectedAccountId}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            selectedAccountId && fetchMoreDialogs(platform, selectedAccountId)
          }
          disabled={loading || !selectedAccountId}
        >
          Load More
        </Button>
        <Button
          variant="text"
          color="secondary"
          onClick={() => selectChat(null)}
          disabled={!selectedChatKey}
        >
          Deselect
        </Button>
      </Stack>

      {/* Account selector */}
      {accounts && accounts.length > 1 && (
        <Stack direction="row" spacing={2}>
          {accounts.map((acc) => (
            <Button
              key={acc.accountId}
              variant={
                selectedAccountId === acc.accountId ? "contained" : "outlined"
              }
              onClick={() => setSelectedAccountId(acc.accountId)}
            >
              {acc.username ||
                acc.firstName ||
                acc.phoneNumber ||
                "Unknown Account"}
            </Button>
          ))}
        </Stack>
      )}

      <Typography variant="body2" color="text.secondary">
        Total Chats: <strong>{chatList.length}</strong>
      </Typography>

      {/* Error & Loading */}
      {error && <Typography color="error">{error}</Typography>}
      {loading && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading dialogs...
          </Typography>
        </Stack>
      )}

      {/* No dialogs */}
      {!loading && chatList.length === 0 && (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          No dialogs loaded yet.
        </Typography>
      )}

      {/* Layout */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          mt: 2,
        }}
      >
        {/* Chat list */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
            maxHeight: "70vh",
          }}
        >
          {chatList.map((chat) => {
            const chatKey = `${chat.platform}:${chat.accountId}:${chat.chatId}`;
            const isSelected = selectedChatKey === chatKey;
            const hasUnread = chat.unreadCount && chat.unreadCount > 0;

            return (
              <Card
                key={chatKey}
                variant="outlined"
                sx={{
                  borderColor: isSelected ? "primary.main" : "divider",
                  backgroundColor: isSelected
                    ? "primary.light"
                    : "background.paper",
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 3 },
                  minHeight: 150,
                  maxHeight: 150,
                }}
                onClick={() => selectChat(chatKey)}
              >
                <CardContent>
                  {/* Header */}
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {chat.title || "Unnamed Chat"}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center">
                      {chat.pinned && (
                        <Tooltip title="Pinned chat">
                          <Chip
                            size="small"
                            color="warning"
                            label="📌"
                            sx={{ fontSize: "0.8rem" }}
                          />
                        </Tooltip>
                      )}
                      <Chip
                        size="small"
                        label={chat.platform.toUpperCase()}
                        color="info"
                        variant="outlined"
                      />
                    </Stack>
                  </Box>

                  {/* Last message */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.5,
                      fontStyle: chat.lastMessage ? "normal" : "italic",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "400px",
                    }}
                  >
                    {chat.lastMessage
                      ? chat.lastMessage.text ||
                        `(${chat.lastMessage.type ?? "unknown"})`
                      : "No messages yet"}
                  </Typography>

                  {/* Date & Views */}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    mt={0.3}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {chat.lastMessage?.date
                        ? new Date(chat.lastMessage.date).toLocaleString()
                        : "No date"}
                    </Typography>
                    {typeof chat.lastMessage?.views === "number" && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        👁 {chat.lastMessage.views}
                      </Typography>
                    )}
                  </Stack>

                  <Divider sx={{ my: 1 }} />

                  {/* Footer */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography
                      variant="caption"
                      color={hasUnread ? "primary" : "text.disabled"}
                    >
                      {hasUnread
                        ? `🔵 ${chat.unreadCount} unread`
                        : "No unread"}
                    </Typography>
                    {isSelected && (
                      <Chip
                        size="small"
                        color="success"
                        label="Selected"
                        sx={{ fontSize: "0.7rem" }}
                      />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Selected chat info */}
        <Paper
          variant="outlined"
          sx={{
            flexBasis: { xs: "100%", md: "40%" },
            p: 3,
            borderRadius: 2,
            minHeight: 300,
          }}
        >
          {selectedChat ? (
            <>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {selectedChat.title}
              </Typography>

              {selectedChat.pinned && (
                <Typography
                  variant="body2"
                  color="warning.main"
                  sx={{ mb: 1, fontWeight: 600 }}
                >
                  📌 Pinned chat
                </Typography>
              )}

              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Chat ID:</strong> {selectedChat.chatId}
                </Typography>
                <Typography variant="body2">
                  <strong>Platform:</strong> {selectedChat.platform}
                </Typography>
                <Typography variant="body2">
                  <strong>Account:</strong> {selectedChat.accountId}
                </Typography>
                <Typography variant="body2">
                  <strong>Unread:</strong> {selectedChat.unreadCount ?? 0}
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Typography variant="subtitle2" color="text.secondary">
                  Last message:
                </Typography>

                {selectedChat.lastMessage ? (
                  <Box sx={{ pl: 1 }}>
                    <Typography variant="body2">
                      <strong>ID:</strong> {selectedChat.lastMessage.id}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Text:</strong>{" "}
                      {selectedChat.lastMessage.text ||
                        `(${selectedChat.lastMessage.type ?? "unknown"})`}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Date:</strong>{" "}
                      {new Date(selectedChat.lastMessage.date).toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                      <strong>From:</strong>{" "}
                      {selectedChat.lastMessage?.from?.name?.trim() ||
                        selectedChat.lastMessage?.from?.username?.trim() ||
                        selectedChat.lastMessage?.from?.id ||
                        "Unknown"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Outgoing:</strong>{" "}
                      {selectedChat.lastMessage.isOutgoing ? "Yes" : "No"}
                    </Typography>
                    {typeof selectedChat.lastMessage.views === "number" && (
                      <Typography variant="body2">
                        <strong>Views:</strong> {selectedChat.lastMessage.views}
                      </Typography>
                    )}
                    {selectedChat.lastMessage.isPinned && (
                      <Typography variant="body2" color="warning.main">
                        📌 This message is pinned
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    fontStyle="italic"
                  >
                    No last message
                  </Typography>
                )}
              </Stack>
            </>
          ) : (
            <Typography
              variant="body2"
              color="text.disabled"
              textAlign="center"
              sx={{ mt: 10, fontStyle: "italic" }}
            >
              Select a chat to view details
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
