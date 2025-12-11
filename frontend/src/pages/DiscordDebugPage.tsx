import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { discordApi } from "../api/discordApi";
import { socketBus } from "../realtime/eventBus";

import type { UnifiedDiscordMessage } from "../types/discord.types";
import type {
  DiscordNewMessagePayload,
  DiscordMessageEditedPayload,
  DiscordMessageDeletedPayload,
} from "../realtime/events";

/* ======================================================================
 * TYPES
 * ====================================================================== */

interface BotInfo {
  id: string;
  botUserId?: string | null;
  botUsername?: string | null;

  guilds: {
    id: string;
    guildId: string;
    name: string | null;
    icon: string | null;
  }[];
}

interface DialogGuild {
  botId: string;
  guildId: string;
  guildName: string;
  channels: {
    chatId: string;
    name: string;
    discordType: "text" | "forum";
    parentId: string | null;
    isThread: boolean;

    threads: {
      chatId: string;
      name: string;
      discordType: "thread";
      parentId: string;
      isThread: true;
    }[];
  }[];
}

/* ======================================================================
 * MAIN DEBUG PAGE COMPONENT
 * ====================================================================== */

export default function DiscordDebugPage() {
  /* ------------------------- BOTS ------------------------- */
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [newToken, setNewToken] = useState("");

  /* -------------------- GUILDS + CHANNELS ----------------- */
  const [dialogs, setDialogs] = useState<any[]>([]);

  /* ------------------------- CHAT -------------------------- */
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [history, setHistory] = useState<UnifiedDiscordMessage[]>([]);
  const [text, setText] = useState("");

  /* ======================================================================
   * BOTS MANAGEMENT
   * ====================================================================== */

  async function loadBots() {
    const { bots } = await discordApi.listBots();
    setBots(bots);
  }

  async function registerBot() {
    if (!newToken.trim()) return;
    await discordApi.registerBot(newToken.trim());
    setNewToken("");
    await loadBots();
    await loadDialogs();
  }

  async function deactivateBot(botId: string) {
    await discordApi.deactivateBot(botId);
    await loadBots();
    await loadDialogs();
  }

  async function refreshBotGuilds(botId: string) {
    await discordApi.refreshGuilds(botId);
    alert("Guilds refreshed!");
    await loadDialogs();
  }

  /* ======================================================================
   * LOAD DIALOGS TREE
   * ====================================================================== */

  async function loadDialogs() {
    const { dialogs } = await discordApi.getDialogs();
    setDialogs(dialogs);
  }

  /* ======================================================================
   * LOAD HISTORY
   * ====================================================================== */

  async function loadHistory(botId: string, chatId: string) {
    const { messages } = await discordApi.getHistory(botId, chatId);
    setHistory(messages.slice().reverse());
  }

  /* ======================================================================
   * SEND MESSAGE
   * ====================================================================== */

  async function sendMessage() {
    if (!text.trim() || !selectedChatId || !selectedBotId) return;

    const { message } = await discordApi.sendText(
      selectedBotId,
      selectedChatId,
      text
    );

    setHistory((prev) => [...prev, message]);
    setText("");
  }

  /* ======================================================================
   * SOCKET.IO — LIVE EVENTS
   * ====================================================================== */

  useEffect(() => {
    const onNew = (d: DiscordNewMessagePayload) => {
      if (
        d.accountId === selectedBotId &&
        d.message.chatId === selectedChatId
      ) {
        setHistory((prev) => [...prev, d.message]);
      }
    };

    const onEdit = (d: DiscordMessageEditedPayload) => {
      if (d.accountId !== selectedBotId || d.chatId !== selectedChatId) return;

      setHistory((prev) =>
        prev.map((m) => (m.messageId === d.messageId ? d.updated! : m))
      );
    };

    const onDelete = (d: DiscordMessageDeletedPayload) => {
      if (d.accountId !== selectedBotId || d.chatId !== selectedChatId) return;

      setHistory((prev) =>
        prev.filter((m) => !d.messageIds.includes(String(m.messageId)))
      );
    };

    socketBus.on("discord:new_message", onNew);
    socketBus.on("discord:message_edited", onEdit);
    socketBus.on("discord:message_deleted", onDelete);

    return () => {
      socketBus.off("discord:new_message", onNew);
      socketBus.off("discord:message_edited", onEdit);
      socketBus.off("discord:message_deleted", onDelete);
    };
  }, [selectedBotId, selectedChatId]);

  /* ======================================================================
   * INIT
   * ====================================================================== */

  useEffect(() => {
    loadBots();
    loadDialogs();
  }, []);

  /* ======================================================================
   * ADD BOT TO SERVER — DISCORD OAUTH2 INVITE
   * ====================================================================== */

  function inviteBotToServer() {
    const permissions = "268445696";
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${permissions}`;

    const win = window.open(url, "_blank", "width=600,height=800");

    const timer = setInterval(() => {
      if (win && win.closed) {
        clearInterval(timer);
        loadDialogs();
        loadBots();
      }
    }, 500);
  }

  /* ======================================================================
   * RENDER UI
   * ====================================================================== */

  return (
    <Box display="flex" gap={2} p={2} height="90vh">
      {/* =========================================================
       * COLUMN 1 — BOTS
       * ========================================================= */}
      <Paper sx={{ width: 300, p: 2, overflow: "auto" }}>
        <Typography variant="h6">Bots</Typography>

        <TextField
          fullWidth
          size="small"
          sx={{ mt: 1 }}
          placeholder="Enter bot token"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
        />

        <Button variant="contained" sx={{ mt: 1 }} onClick={registerBot}>
          Add Bot
        </Button>

        <Button variant="outlined" sx={{ mt: 1 }} onClick={inviteBotToServer}>
          ➕ Add Bot to Server
        </Button>

        <Divider sx={{ my: 2 }} />

        <List dense>
          {bots.map((b) => (
            <ListItemButton
              key={b.id}
              selected={selectedBotId === b.id}
              onClick={() => {
                setSelectedBotId(b.id);
                setSelectedChatId("");
                setHistory([]);
              }}
            >
              <ListItemText
                primary={b.botUsername || "Bot"}
                secondary={`Bot ID: ${b.id}`}
              />
              <Button onClick={() => refreshBotGuilds(b.id)}>↻</Button>
              <Button color="error" onClick={() => deactivateBot(b.id)}>
                X
              </Button>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* =========================================================
       * COLUMN 2 — CHANNEL TREE
       * ========================================================= */}
      <Paper sx={{ width: 350, p: 2, overflow: "auto" }}>
        <Typography variant="h6">Channels</Typography>

        <Divider sx={{ my: 2 }} />

        {!selectedBotId && (
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Select a bot to view channels.
          </Typography>
        )}

        {dialogs
          .filter((d) => d.botId === selectedBotId)
          .flatMap((bot) => bot.guilds)
          .map((g: DialogGuild) => (
            <Box key={g.guildId} sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{g.guildName}</Typography>

              {g.channels.map((ch) => (
                <Box key={ch.chatId} sx={{ ml: 2, mt: 1 }}>
                  <ListItemButton
                    selected={selectedChatId === ch.chatId}
                    onClick={() => {
                      setSelectedChatId(ch.chatId);
                      loadHistory(selectedBotId, ch.chatId);
                    }}
                  >
                    <ListItemText primary={`# ${ch.name}`} />
                  </ListItemButton>

                  {/* THREADS */}
                  {ch.threads?.map((t) => (
                    <ListItemButton
                      key={t.chatId}
                      sx={{ ml: 4 }}
                      selected={selectedChatId === t.chatId}
                      onClick={() => {
                        setSelectedChatId(t.chatId);
                        loadHistory(selectedBotId, t.chatId);
                      }}
                    >
                      <ListItemText primary={`💬 ${t.name}`} />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </Box>
          ))}
      </Paper>

      {/* =========================================================
       * COLUMN 3 — CHAT
       * ========================================================= */}
      <Paper sx={{ flex: 1, p: 2, display: "flex", flexDirection: "column" }}>
        <Typography variant="h6">Chat</Typography>

        <Box flex={1} overflow="auto" mt={1}>
          {selectedChatId ? (
            history.map((m) => (
              <Box
                key={m.messageId}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: m.isOutgoing ? "primary.main" : "grey.800",
                  color: "white",
                  maxWidth: "80%",
                  alignSelf: m.isOutgoing ? "flex-end" : "flex-start",
                }}
              >
                <Typography variant="caption">
                  <b>{m.from.name}</b>
                </Typography>
                <Typography variant="body2">{m.text}</Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">
              Select channel to view messages.
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 1 }} />

        <TextField
          size="small"
          fullWidth
          disabled={!selectedChatId}
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <Button
          variant="contained"
          disabled={!selectedChatId}
          sx={{ mt: 1 }}
          onClick={sendMessage}
        >
          Send
        </Button>
      </Paper>
    </Box>
  );
}
