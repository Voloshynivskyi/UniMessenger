import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import {
  discordApi,
  type DiscordAccount,
  type DiscordDialogGuild,
} from "../api/discordApi";

import { socketBus } from "../realtime/eventBus";

import type {
  DiscordNewMessagePayload,
  DiscordMessageEditedPayload,
  DiscordMessageDeletedPayload,
  DiscordTypingPayload,
} from "../realtime/events";

import type { UnifiedDiscordMessage } from "../types/discord.types";

/**
 * FULL Discord Dev / Debug Page
 */
export default function DiscordDebugPage() {
  // Accounts
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<DiscordAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [botToken, setBotToken] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  // Dialogs / Channels
  const [dialogsLoading, setDialogsLoading] = useState(false);
  const [dialogs, setDialogs] = useState<DiscordDialogGuild[]>([]);

  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChannelName, setSelectedChannelName] = useState<string>("");

  // History
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<UnifiedDiscordMessage[]>([]);

  // Sending
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  // Logs
  const [logs, setLogs] = useState<string[]>([]);

  function appendLog(line: string) {
    setLogs((prev) => [line, ...prev].slice(0, 200));
  }

  // Flatten channels (forum + threads)
  const flatChannels = useMemo(() => {
    const result: { id: string; label: string }[] = [];

    dialogs.forEach((g) => {
      g.channels.forEach((ch) => {
        const parent = ch.parentId
          ? g.channels.find((p) => p.id === ch.parentId)
          : null;

        let label = `${g.guildName} / `;

        if (parent) {
          label += `#${parent.name} / ${ch.name}`;
        } else {
          label += `#${ch.name}`;
        }

        result.push({
          id: ch.id,
          label,
        });
      });
    });

    return result;
  }, [dialogs]);

  // ADD ACCOUNT
  async function handleAddAccount() {
    if (!botToken.trim()) {
      appendLog("❌ botToken is empty");
      return;
    }

    try {
      setAddingAccount(true);
      const res = await discordApi.addAccount(botToken);

      appendLog(`✅ Discord account added: ${res.id}`);
      setBotToken("");

      await loadAccounts();
    } catch (err: any) {
      appendLog(`❌ addAccount error: ${err?.message ?? String(err)}`);
    } finally {
      setAddingAccount(false);
    }
  }

  // LOAD ACCOUNTS
  async function loadAccounts() {
    try {
      setLoadingAccounts(true);
      const data = await discordApi.getAccounts();
      setAccounts(data);

      if (!selectedAccountId && data.length > 0) {
        setSelectedAccountId(data[0].id);
        await loadDialogs(data[0].id);
      }

      appendLog(`Loaded ${data.length} Discord accounts`);
    } catch (err: any) {
      appendLog(`❌ loadAccounts error: ${err?.message ?? String(err)}`);
    } finally {
      setLoadingAccounts(false);
    }
  }

  // LOAD DIALOGS
  async function loadDialogs(accountId: string) {
    try {
      setDialogsLoading(true);
      const data = await discordApi.getDialogs(accountId);
      setDialogs(data);
      appendLog(`Loaded dialogs for account=${accountId}`);
    } catch (err: any) {
      appendLog(`❌ loadDialogs error: ${err?.message ?? String(err)}`);
    } finally {
      setDialogsLoading(false);
    }
  }

  // LOAD HISTORY
  async function loadHistoryForSelectedChannel() {
    if (!selectedAccountId || !selectedChannelId) return;

    try {
      setHistoryLoading(true);

      const messages = await discordApi.getHistory({
        accountId: selectedAccountId,
        channelId: selectedChannelId,
        limit: 50,
      });

      setHistory(messages.slice().reverse());

      appendLog(
        `Loaded history: ${messages.length} messages for channel=${selectedChannelId}`
      );
    } catch (err: any) {
      appendLog(`❌ loadHistory error: ${err?.message ?? String(err)}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  // SEND MESSAGE
  async function handleSend() {
    if (!selectedAccountId || !selectedChannelId || !messageText.trim()) return;

    try {
      setSending(true);

      const msg = await discordApi.sendText({
        accountId: selectedAccountId,
        channelId: selectedChannelId,
        text: messageText,
      });

      appendLog(`✅ Sent message ${msg.messageId}`);
      setMessageText("");
    } catch (err: any) {
      appendLog(`❌ sendText error: ${err?.message ?? String(err)}`);
    } finally {
      setSending(false);
    }
  }

  // SOCKET EVENTS
  useEffect(() => {
    function onNew(data: DiscordNewMessagePayload) {
      const msg = data.message;

      appendLog(
        `📩 [new] acc=${data.accountId} chat=${msg.chatId} parent=${
          msg.parentChatId ?? "-"
        }`
      );

      if (data.accountId !== selectedAccountId) return;

      const isDirectMatch = msg.chatId === selectedChannelId;
      const isThreadUnderSelected = msg.parentChatId === selectedChannelId;

      if (isDirectMatch || isThreadUnderSelected) {
        setHistory((prev) => {
          if (prev.some((m) => m.messageId === msg.messageId)) return prev;
          return [...prev, msg];
        });
      }
    }

    function onEdited(data: DiscordMessageEditedPayload) {
      if (
        data.accountId === selectedAccountId &&
        data.chatId === selectedChannelId &&
        data.updated
      ) {
        setHistory((prev) =>
          prev.map((m) => (m.messageId === data.messageId ? data.updated! : m))
        );
      }
    }

    function onDeleted(data: DiscordMessageDeletedPayload) {
      if (
        data.accountId === selectedAccountId &&
        data.chatId === selectedChannelId
      ) {
        setHistory((prev) =>
          prev.filter((m) => !data.messageIds.includes(m.messageId))
        );
      }
    }

    function onTyping(data: DiscordTypingPayload) {
      appendLog(
        `⌨️ [typing] acc=${data.accountId} chat=${data.chatId} user=${data.username}`
      );
    }

    socketBus.on("discord:new_message", onNew);
    socketBus.on("discord:message_edited", onEdited);
    socketBus.on("discord:message_deleted", onDeleted);
    socketBus.on("discord:typing", onTyping);

    return () => {
      socketBus.off("discord:new_message", onNew);
      socketBus.off("discord:message_edited", onEdited);
      socketBus.off("discord:message_deleted", onDeleted);
      socketBus.off("discord:typing", onTyping);
    };
  }, [selectedAccountId, selectedChannelId]);

  // AUTO LOAD
  useEffect(() => {
    void loadAccounts();
  }, []);

  // UI
  return (
    <Box p={2} display="flex" gap={2} height="100%">
      <Box flex={2} display="flex" flexDirection="column" gap={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Discord Debug Panel
          </Typography>

          <Box display="flex" gap={2} mb={2}>
            <TextField
              fullWidth
              size="small"
              label="Discord Bot Token"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={handleAddAccount}
              disabled={!botToken.trim() || addingAccount}
            >
              {addingAccount ? "Adding…" : "Add"}
            </Button>
          </Box>

          <Box display="flex" gap={2} mb={2}>
            <Box flex={1}>
              <Typography variant="subtitle2">Account</Typography>
              <Select
                fullWidth
                size="small"
                value={selectedAccountId || ""}
                onChange={(e) => {
                  const value = e.target.value as string;
                  setSelectedAccountId(value);
                  setDialogs([]);
                  setSelectedChannelId("");
                  setHistory([]);
                  if (value) void loadDialogs(value);
                }}
              >
                {accounts.map((acc) => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.botUsername || acc.id}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Button
              variant="outlined"
              onClick={loadAccounts}
              disabled={loadingAccounts}
            >
              {loadingAccounts ? "Loading…" : "Reload"}
            </Button>
          </Box>

          <Box display="flex" gap={2} mb={2}>
            <Box flex={1}>
              <Typography variant="subtitle2">Channel</Typography>
              <Select
                fullWidth
                size="small"
                value={selectedChannelId || ""}
                onChange={(e) => {
                  const id = e.target.value as string;
                  setSelectedChannelId(id);
                  const ch = flatChannels.find((c) => c.id === id);
                  setSelectedChannelName(ch?.label ?? "");
                  setHistory([]);
                }}
              >
                <MenuItem value="">
                  <em>Select channel</em>
                </MenuItem>
                {flatChannels.map((ch) => (
                  <MenuItem key={ch.id} value={ch.id}>
                    {ch.label}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Button
              variant="outlined"
              onClick={loadHistoryForSelectedChannel}
              disabled={!selectedChannelId || historyLoading}
            >
              {historyLoading ? "Loading…" : "Load history"}
            </Button>
          </Box>

          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              size="small"
              label="Message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!messageText.trim() || sending || !selectedChannelId}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, overflow: "auto" }}>
          <Typography variant="subtitle1" gutterBottom>
            History
          </Typography>
          <Divider sx={{ mb: 1 }} />

          {history.map((m) => (
            <Box key={m.messageId} mb={1} p={1} border="1px solid #ddd">
              <Typography variant="caption">
                {m.from?.name || "unknown"} —{" "}
                {new Date(m.date).toLocaleString()}
              </Typography>
              <Typography variant="body2">{m.text || "<no text>"}</Typography>
            </Box>
          ))}
        </Paper>
      </Box>

      <Box flex={1}>
        <Paper sx={{ p: 2, height: "100%", overflow: "auto" }}>
          <Typography variant="subtitle1">Socket Logs</Typography>
          <Divider sx={{ mb: 1 }} />

          {logs.map((l, i) => (
            <Typography key={i} variant="caption" display="block">
              {l}
            </Typography>
          ))}
        </Paper>
      </Box>
    </Box>
  );
}
