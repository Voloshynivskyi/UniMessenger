// frontend/src/context/UnifiedDialogsContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type {
  UnifiedChatPlatform,
  UnifiedChat,
} from "../types/unifiedChat.types";
import { telegramApi } from "../api/telegramApi";
import { discordApi } from "../api/discordApi";
import { socketBus } from "../realtime/eventBus";

import type {
  TelegramNewMessagePayload,
  TelegramMessageEditedPayload,
  TelegramMessageDeletedPayload,
  TelegramReadUpdatesPayload,
  TelegramTypingPayload,
  TelegramAccountStatusPayload,
  TelegramPinnedMessagesPayload,
  TelegramMessageViewPayload,
  TelegramMessageConfirmedPayload,
} from "../realtime/events";
import { useTelegram } from "./TelegramAccountContext";
import { buildChatKey, parseChatKey } from "../pages/inbox/utils/chatUtils";

/* ====================================================================== */
/* Helpers */
/* ====================================================================== */

/** Map Discord message type to sidebar "kind" */
function mapDiscordMessageTypeToSidebarType(t: string) {
  switch (t) {
    case "text":
      return "text";
    case "photo":
      return "photo";
    case "video":
      return "video";
    case "file":
      return "file";
    case "gif":
      return "video";
    case "link":
      return "link";
    default:
      return "unknown";
  }
}

/** If Discord text is empty — show media placeholder */
function buildDiscordPreviewText(text?: string | null, type?: string) {
  const trimmed = text?.trim();
  if (trimmed) return trimmed;

  switch (type) {
    case "photo":
      return "📷 Photo";
    case "video":
      return "🎬 Video";
    case "gif":
      return "🎞 GIF";
    case "file":
      return "📎 File";
    case "link":
      return "🔗 Link";
    default:
      return "";
  }
}

/** Map Telegram message type to sidebar "kind" */
function mapMessageTypeToSidebarType(t: UnifiedTelegramMessage["type"]) {
  switch (t) {
    case "text":
      return "text";
    case "photo":
      return "photo";
    case "video":
    case "animation":
    case "video_note":
      return "video";
    case "voice":
    case "audio":
      return "voice";
    case "sticker":
      return "sticker";
    case "file":
      return "file";
    case "service":
      return "service";
    default:
      return "unknown";
  }
}

/** Emoji + label for media if no text (Telegram) */
function buildSidebarPreviewText(
  text: string | null | undefined,
  type?: UnifiedTelegramMessage["type"]
): string {
  const trimmed = text?.trim();
  if (trimmed) return trimmed;

  switch (type) {
    case "photo":
      return "📷 Photo";
    case "video":
      return "🎬 Video";
    case "animation":
      return "🎞 GIF";
    case "video_note":
      return "🎥 Video note";
    case "voice":
      return "🎤 Voice message";
    case "audio":
      return "🎵 Audio";
    case "sticker":
      return "🖼 Sticker";
    case "file":
      return "📎 File";
    case "service":
      return "ℹ️ Service message";
    default:
      return "";
  }
}

/** Sort chats (used і для Telegram, і для Discord) */
function sortChats(
  chats: Record<string, UnifiedChat>
): Record<string, UnifiedChat> {
  const sortedEntries = Object.entries(chats).sort(([_, a], [__, b]) => {
    // 1️⃣ pinned chats always on top
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // 2️⃣ By date of the last message
    const dateA = new Date(a.lastMessage?.date || 0).getTime();
    const dateB = new Date(b.lastMessage?.date || 0).getTime();
    return dateB - dateA;
  });

  return Object.fromEntries(sortedEntries);
}

/* ====================================================================== */
/* Types */
/* ====================================================================== */

interface DiscordBotDialogs {
  botId: string;
  botUserId?: string | null;
  botUsername?: string | null;
  guilds: any[]; // структура з DiscordClientManager.getDialogsTree
}

interface UnifiedDialogsContextType {
  /* Telegram + Discord chats (unified list, currently only Telegram used for sidebar) */
  chatsByAccount: Record<string, Record<string, UnifiedChat>>;

  /* Typing across all platforms (key is chatKey) */
  typingByChat: Record<string, { users: { id: string; name: string }[] }>;

  /* Currently selected chat (telegram:acc:chat or discord:botId:channelId) */
  selectedChatKey: string | null;

  loading: boolean;
  error: string | null;

  /* Telegram dialogs */
  fetchDialogs: (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => Promise<void>;
  fetchMoreDialogs: (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => Promise<void>;
  selectChat: (chatKey: string | null) => void;

  /* Optimistic update для Telegram outgoing */
  applyOptimisticOutgoing: (
    chatKey: string,
    message: UnifiedTelegramMessage
  ) => void;

  /* Discord dialogs — дерево бот → гільдії → канали/треди */
  discordDialogsByBot: Record<string, DiscordBotDialogs>;
  fetchDiscordDialogs: () => Promise<void>;
}

const UnifiedDialogsContext = createContext<UnifiedDialogsContextType | null>(
  null
);

export const UnifiedDialogsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  /* Telegram + Discord чати за accountId/botId */
  const [chatsByAccount, setChatsByAccount] = useState<
    Record<string, Record<string, UnifiedChat>>
  >({});

  /* Telegram dialog pagination offsets */
  const [nextOffsetByAccount, setNextOffsetByAccount] = useState<
    Record<string, any | null>
  >({});

  /* Typing (Telegram + Discord) */
  const [typingByChat, setTypingByChat] = useState<
    Record<string, { users: { id: string; name: string }[] }>
  >({});

  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Discord dialogs дерево (окрема секція в UI) */
  const [discordDialogsByBot, setDiscordDialogsByBot] = useState<
    Record<string, DiscordBotDialogs>
  >({});

  const { accounts } = useTelegram();

  /* ============================================================
   * When selecting Telegram chat trigger read-updates to backend
   * (for Discord we do nothing here)
   * ============================================================ */
  useEffect(() => {
    if (!selectedChatKey) return;

    const { platform, accountId } = parseChatKey(selectedChatKey);
    if (platform !== "telegram") return;

    const chat = chatsByAccount[accountId]?.[selectedChatKey];
    if (!chat) return;
    if (!chat.peerType) return;

    telegramApi.getMessageHistory({
      accountId,
      peerType: chat.peerType,
      peerId: chat.chatId,
      accessHash: (chat as any).accessHash ?? null,
    });
  }, [selectedChatKey, chatsByAccount]);

  /* ============================================================
   * SOCKET EVENTS — TELEGRAM + DISCORD (typing + lastMessage)
   * ============================================================ */
  useEffect(() => {
    if (!accounts?.length) {
      // No Telegram accounts - but Discord can still work
    }

    /* ------------------- TELEGRAM EVENTS ------------------- */

    const handleNewMessage = (data: TelegramNewMessagePayload) => {
      const chatKey = buildChatKey(data.platform, data.accountId, data.chatId);

      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId] || {};
        const existing = accountChats[chatKey];

        const baseChat: UnifiedChat = existing || {
          platform: data.platform,
          accountId: data.accountId,
          chatId: data.chatId,
          title: data.message.from?.name || "Unknown chat",
          unreadCount: 0,
          pinned: false,
        };

        const newUnreadCount = data.message.isOutgoing
          ? baseChat.unreadCount
          : (baseChat.unreadCount ?? 0) + 1;

        const previewText = buildSidebarPreviewText(
          data.message.text,
          data.message.type
        );

        const updatedChat: UnifiedChat = {
          ...baseChat,
          lastMessage: {
            id: String(data.message.messageId),
            text: previewText,
            type: mapMessageTypeToSidebarType(data.message.type),
            date: data.message.date,
            from: {
              id: data.message.from.id,
              name: data.message.from.name,
            },
            isOutgoing: data.message.isOutgoing,
          },
          unreadCount: newUnreadCount,
        };

        // Скидаємо typing для цього чату
        setTypingByChat((prevTyping) => {
          const copy = { ...prevTyping };
          delete copy[chatKey];
          return copy;
        });

        const merged = { ...accountChats, [chatKey]: updatedChat };
        return { ...prev, [data.accountId]: sortChats(merged) };
      });
    };

    const handleMessageEdited = (data: TelegramMessageEditedPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (!existing?.lastMessage) return prev;

        const lastId = String(existing.lastMessage.id);
        const editedId = String(data.messageId);
        if (lastId !== editedId) return prev;

        const updatedText = buildSidebarPreviewText(
          data.newText,
          existing.lastMessage.type as UnifiedTelegramMessage["type"]
        );

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: updatedText,
          },
        };

        const updated = {
          ...accountChats,
          [chatKey]: updatedChat,
        };

        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handleMessageDeleted = (data: TelegramMessageDeletedPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (!existing?.lastMessage) return prev;

        const lastId = String(existing.lastMessage.id);
        const isLastDeleted = data.messageIds
          .map((id) => String(id))
          .includes(lastId);

        if (!isLastDeleted) return prev;

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: "Message deleted",
          },
        };

        const updated = {
          ...accountChats,
          [chatKey]: updatedChat,
        };

        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handleReadUpdates = (data: TelegramReadUpdatesPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (!existing) return prev;

        const updated = {
          ...accountChats,
          [chatKey]: { ...existing, unreadCount: 0 },
        };
        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handlePinnedMessages = (data: TelegramPinnedMessagesPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (!existing) return prev;

        const updated = {
          ...accountChats,
          [chatKey]: { ...existing, pinned: data.pinned },
        };
        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handleMessageViews = (data: TelegramMessageViewPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (
          !existing?.lastMessage ||
          existing.lastMessage.id !== data.messageId
        )
          return prev;

        const updated = {
          ...accountChats,
          [chatKey]: {
            ...existing,
            lastMessage: { ...existing.lastMessage, views: data.views },
          },
        };
        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handleAccountStatus = (data: TelegramAccountStatusPayload) => {
      console.log(`[Account ${data.accountId}] Status: ${data.status}`);
    };

    const handleMessageConfirmed = (data: TelegramMessageConfirmedPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const chatKey = buildChatKey(
          data.platform,
          data.accountId,
          data.chatId
        );
        const existing = accountChats[chatKey];
        if (!existing?.lastMessage) return prev;

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            id: data.message.messageId,
            date: data.message.date,
          },
        };

        const merged = { ...accountChats, [chatKey]: updatedChat };
        return { ...prev, [data.accountId]: sortChats(merged) };
      });
    };

    /* ------------------- TELEGRAM TYPING ------------------- */

    const handleTyping = (data: TelegramTypingPayload) => {
      const chatKey = buildChatKey(data.platform, data.accountId, data.chatId);
      const userKey = `${chatKey}:${data.userId}`;

      if (!data.isTyping) {
        if (typingTimeouts.current[userKey]) {
          clearTimeout(typingTimeouts.current[userKey]);
          delete typingTimeouts.current[userKey];
        }

        setTypingByChat((prevTyping) => {
          const existing = prevTyping[chatKey]?.users ?? [];
          const filtered = existing.filter((u) => u.id !== data.userId);

          if (filtered.length === 0) {
            const copy = { ...prevTyping };
            delete copy[chatKey];
            return copy;
          }

          return { ...prevTyping, [chatKey]: { users: filtered } };
        });

        return;
      }

      // isTyping === true → add / update
      setTypingByChat((prevTyping) => {
        const existing = prevTyping[chatKey]?.users ?? [];
        const filtered = existing.filter((u) => u.id !== data.userId);
        const updated = [...filtered, { id: data.userId, name: data.username }];
        return { ...prevTyping, [chatKey]: { users: updated } };
      });

      if (typingTimeouts.current[userKey]) {
        clearTimeout(typingTimeouts.current[userKey]);
      }

      typingTimeouts.current[userKey] = setTimeout(() => {
        setTypingByChat((prevTyping) => {
          const existing = prevTyping[chatKey]?.users ?? [];
          const filtered = existing.filter((u) => u.id !== data.userId);

          if (filtered.length === 0) {
            const copy = { ...prevTyping };
            delete copy[chatKey];
            return copy;
          }

          return { ...prevTyping, [chatKey]: { users: filtered } };
        });

        delete typingTimeouts.current[userKey];
      }, 5000);
    };

    /* ------------------- DISCORD EVENTS ------------------- */

    // { platform:"discord", accountId:botId, chatId, message:{...} }
    const handleDiscordNewMessage = (data: any) => {
      if (data.platform !== "discord") return;

      const chatKey = buildChatKey("discord", data.accountId, data.chatId);
      const msg = data.message;

      const preview = buildDiscordPreviewText(msg.text, msg.type);

      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId] || {};
        const existing = accountChats[chatKey];

        const baseChat: UnifiedChat =
          existing ||
          ({
            platform: "discord",
            accountId: data.accountId,
            chatId: data.chatId,
            title: msg.channelName ?? "Unknown",
            displayName: msg.channelName ?? "Unknown",
            unreadCount: 0,
            pinned: false,
          } as UnifiedChat);

        const updated: UnifiedChat = {
          ...baseChat,
          lastMessage: {
            id: String(msg.messageId),
            text: preview,
            type: mapDiscordMessageTypeToSidebarType(msg.type),
            date: msg.date,
            from: msg.from,
            isOutgoing: msg.isOutgoing,
          },
          unreadCount: msg.isOutgoing
            ? baseChat.unreadCount ?? 0
            : (baseChat.unreadCount ?? 0) + 1,
        };

        return {
          ...prev,
          [data.accountId]: sortChats({
            ...accountChats,
            [chatKey]: updated,
          }),
        };
      });
    };

    const handleDiscordDeletedMessage = (data: any) => {
      if (data.platform !== "discord") return;

      const chatKey = buildChatKey("discord", data.accountId, data.chatId);

      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const existing = accountChats[chatKey];
        if (!existing?.lastMessage) return prev;

        const deletedIds = (data.messageIds ?? []).map((id: any) => String(id));
        if (!deletedIds.includes(String(existing.lastMessage.id))) return prev;

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: "Message deleted",
          },
        };

        return {
          ...prev,
          [data.accountId]: sortChats({
            ...accountChats,
            [chatKey]: updatedChat,
          }),
        };
      });
    };

    const handleDiscordEditedMessage = (data: any) => {
      if (data.platform !== "discord") return;

      const chatKey = buildChatKey("discord", data.accountId, data.chatId);

      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;

        const existing = accountChats[chatKey];
        if (!existing?.lastMessage) return prev;

        if (String(existing.lastMessage.id) !== String(data.messageId))
          return prev;

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: buildDiscordPreviewText(
              data.updated?.text,
              data.updated?.type
            ),
          },
        };

        return {
          ...prev,
          [data.accountId]: sortChats({
            ...accountChats,
            [chatKey]: updatedChat,
          }),
        };
      });
    };

    // { platform:"discord", accountId:botId, chatId, userId, username, isTyping }
    const handleDiscordTyping = (data: any) => {
      if (data.platform !== "discord") return;

      const chatKey = buildChatKey("discord", data.accountId, data.chatId);
      const userKey = `${chatKey}:${data.userId}`;

      if (!data.isTyping) {
        if (typingTimeouts.current[userKey]) {
          clearTimeout(typingTimeouts.current[userKey]);
          delete typingTimeouts.current[userKey];
        }

        setTypingByChat((prevTyping) => {
          const existing = prevTyping[chatKey]?.users ?? [];
          const filtered = existing.filter((u) => u.id !== data.userId);

          if (filtered.length === 0) {
            const copy = { ...prevTyping };
            delete copy[chatKey];
            return copy;
          }

          return { ...prevTyping, [chatKey]: { users: filtered } };
        });

        return;
      }

      setTypingByChat((prevTyping) => {
        const existing = prevTyping[chatKey]?.users ?? [];
        const filtered = existing.filter((u) => u.id !== data.userId);
        const updated = [...filtered, { id: data.userId, name: data.username }];
        return { ...prevTyping, [chatKey]: { users: updated } };
      });

      if (typingTimeouts.current[userKey]) {
        clearTimeout(typingTimeouts.current[userKey]);
      }

      typingTimeouts.current[userKey] = setTimeout(() => {
        setTypingByChat((prevTyping) => {
          const existing = prevTyping[chatKey]?.users ?? [];
          const filtered = existing.filter((u) => u.id !== data.userId);

          if (filtered.length === 0) {
            const copy = { ...prevTyping };
            delete copy[chatKey];
            return copy;
          }

          return { ...prevTyping, [chatKey]: { users: filtered } };
        });

        delete typingTimeouts.current[userKey];
      }, 5000);
    };

    /* ------------------- SUBSCRIBE ------------------- */

    socketBus.on("telegram:new_message", handleNewMessage);
    socketBus.on("telegram:typing", handleTyping);
    socketBus.on("telegram:message_edited", handleMessageEdited);
    socketBus.on("telegram:message_deleted", handleMessageDeleted);
    socketBus.on("telegram:read_updates", handleReadUpdates);
    socketBus.on("telegram:message_views", handleMessageViews);
    socketBus.on("telegram:pinned_messages", handlePinnedMessages);
    socketBus.on("telegram:account_status", handleAccountStatus);
    socketBus.on("telegram:message_confirmed", handleMessageConfirmed);

    socketBus.on("discord:new_message", handleDiscordNewMessage);
    socketBus.on("discord:message_edited", handleDiscordEditedMessage);
    socketBus.on("discord:message_deleted", handleDiscordDeletedMessage);
    socketBus.on("discord:typing", handleDiscordTyping);

    return () => {
      socketBus.off("telegram:new_message", handleNewMessage);
      socketBus.off("telegram:typing", handleTyping);
      socketBus.off("telegram:message_edited", handleMessageEdited);
      socketBus.off("telegram:message_deleted", handleMessageDeleted);
      socketBus.off("telegram:read_updates", handleReadUpdates);
      socketBus.off("telegram:message_views", handleMessageViews);
      socketBus.off("telegram:pinned_messages", handlePinnedMessages);
      socketBus.off("telegram:account_status", handleAccountStatus);
      socketBus.off("telegram:message_confirmed", handleMessageConfirmed);

      socketBus.off("discord:new_message", handleDiscordNewMessage);
      socketBus.off("discord:message_edited", handleDiscordEditedMessage);
      socketBus.off("discord:message_deleted", handleDiscordDeletedMessage);
      socketBus.off("discord:typing", handleDiscordTyping);

      for (const key of Object.keys(typingTimeouts.current)) {
        clearTimeout(typingTimeouts.current[key]);
      }
      typingTimeouts.current = {};
    };
  }, [accounts?.length, chatsByAccount]);

  /* ============================================================
   * FETCH DIALOGS — TELEGRAM
   * ============================================================ */
  const fetchDialogs = async (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => {
    if (!accountId) return;
    if (platform !== "telegram") return; // Discord dialogs are fetched separately

    try {
      setLoading(true);
      let res;
      switch (platform) {
        case "telegram":
          res = await telegramApi.getLatestDialogs(accountId);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      const newChats: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        const chatKey = buildChatKey(platform, accountId, chat.chatId);

        const lm = chat.lastMessage;
        const lmType = (lm?.type as UnifiedTelegramMessage["type"]) || "text";
        const lmText = buildSidebarPreviewText(lm?.text, lmType);

        newChats[chatKey] = {
          ...chat,
          platform,
          accountId,
          lastMessage: lm
            ? {
                ...lm,
                type: lmType,
                text: lmText,
              }
            : undefined,
        };
      }

      setChatsByAccount((prev) => {
        const updated = { ...(prev[accountId] || {}), ...newChats };
        return { ...prev, [accountId]: sortChats(updated) };
      });

      setNextOffsetByAccount((prev) => ({
        ...prev,
        [accountId]: res.nextOffset || null,
      }));
    } catch (err) {
      console.error("Failed to fetch dialogs", err);
      setError("Failed to load dialogs");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
   * FETCH MORE — TELEGRAM
   * ============================================================ */
  const fetchMoreDialogs = async (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => {
    if (platform !== "telegram") return;

    const nextOffset = nextOffsetByAccount[accountId];
    if (!nextOffset) return;
    try {
      setLoading(true);
      let res;
      switch (platform) {
        case "telegram":
          res = await telegramApi.getDialogs(accountId, nextOffset);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const newChats: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        const chatKey = buildChatKey(platform, accountId, chat.chatId);

        const lm = chat.lastMessage;
        const lmType = (lm?.type as UnifiedTelegramMessage["type"]) || "text";
        const lmText = buildSidebarPreviewText(lm?.text, lmType);

        newChats[chatKey] = {
          ...chat,
          platform,
          accountId,
          lastMessage: lm
            ? {
                ...lm,
                type: lmType,
                text: lmText,
              }
            : undefined,
        };
      }

      setChatsByAccount((prev) => {
        const updated = { ...(prev[accountId] || {}), ...newChats };
        return { ...prev, [accountId]: sortChats(updated) };
      });

      setNextOffsetByAccount((prev) => ({
        ...prev,
        [accountId]: res.nextOffset || null,
      }));
    } catch (err) {
      console.error("Failed to load more dialogs", err);
      setError("Failed to load more dialogs");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
   * DISCORD DIALOGS — дерево бот → гільдії → канали/треди
   * ============================================================ */
  const fetchDiscordDialogs = useCallback(async () => {
    try {
      setLoading(true);
      const { dialogs } = await discordApi.getDialogs();

      const map: Record<string, DiscordBotDialogs> = {};
      for (const d of dialogs as DiscordBotDialogs[]) {
        map[d.botId] = d;
      }
      setDiscordDialogsByBot(map);
    } catch (err) {
      console.error("Failed to fetch Discord dialogs", err);
      setError("Failed to load Discord dialogs");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============================================================
   * Helpers
   * ============================================================ */

  const selectChat = (chatKey: string | null) => setSelectedChatKey(chatKey);

  // Optimistic lastMessage update for outgoing pending Telegram messages
  const applyOptimisticOutgoing = (
    chatKey: string,
    message: UnifiedTelegramMessage
  ) => {
    const { accountId } = parseChatKey(chatKey);
    setChatsByAccount((prev) => {
      const accountChats = prev[accountId];
      if (!accountChats) return prev;
      const existing = accountChats[chatKey];
      if (!existing) return prev;

      const previewText = buildSidebarPreviewText(message.text, message.type);

      const updatedChat: UnifiedChat = {
        ...existing,
        lastMessage: {
          id: String(message.messageId),
          text: previewText,
          type: mapMessageTypeToSidebarType(message.type),
          date: message.date,
          from: message.from,
          isOutgoing: true,
        },
        unreadCount: existing.unreadCount ?? 0,
      };

      const merged = { ...accountChats, [chatKey]: updatedChat };
      return { ...prev, [accountId]: sortChats(merged) };
    });
  };

  const value: UnifiedDialogsContextType = {
    chatsByAccount,
    selectedChatKey,
    loading,
    error,
    fetchDialogs,
    fetchMoreDialogs,
    selectChat,
    applyOptimisticOutgoing,
    typingByChat,

    discordDialogsByBot,
    fetchDiscordDialogs,
  };

  return (
    <UnifiedDialogsContext.Provider value={value}>
      {children}
    </UnifiedDialogsContext.Provider>
  );
};

export const useUnifiedDialogs = () => {
  const ctx = useContext(UnifiedDialogsContext);
  if (!ctx)
    throw new Error(
      "useUnifiedDialogs must be used within UnifiedDialogsProvider"
    );
  return ctx;
};
