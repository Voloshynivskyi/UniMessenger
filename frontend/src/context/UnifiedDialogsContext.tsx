// frontend/src/context/UnifiedDialogsContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type {
  UnifiedChatPlatform,
  UnifiedChat,
} from "../types/unifiedChat.types";
import { telegramApi } from "../api/telegramApi";
import { socketClient } from "../realtime/socketClient";
import type {
  TelegramNewMessagePayload,
  TelegramMessageEditedPayload,
  TelegramMessageDeletedPayload,
  TelegramReadUpdatesPayload,
  TelegramTypingPayload,
  TelegramAccountStatusPayload,
  TelegramPinnedMessagesPayload,
  TelegramMessageViewPayload,
} from "../realtime/events";
import { useTelegram } from "./TelegramAccountContext";
import { buildChatKey, parseChatKey } from "../pages/inbox/utils/chatUtils";

/* Sort chats utility */
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

interface UnifiedDialogsContextType {
  chatsByAccount: Record<string, Record<string, UnifiedChat>>;
  typingByChat: Record<string, { users: { id: string; name: string }[] }>;
  selectedChatKey: string | null;
  loading: boolean;
  error: string | null;
  fetchDialogs: (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => Promise<void>;
  fetchMoreDialogs: (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => Promise<void>;
  selectChat: (chatKey: string | null) => void;
  /** Optimistically bump lastMessage for outgoing pending message */
  applyOptimisticOutgoing: (
    chatKey: string,
    message: UnifiedTelegramMessage
  ) => void;
}

const UnifiedDialogsContext = createContext<UnifiedDialogsContextType | null>(
  null
);

export const UnifiedDialogsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [chatsByAccount, setChatsByAccount] = useState<
    Record<string, Record<string, UnifiedChat>>
  >({});
  const [nextOffsetByAccount, setNextOffsetByAccount] = useState<
    Record<string, any | null>
  >({});
  const [typingByChat, setTypingByChat] = useState<
    Record<string, { users: { id: string; name: string }[] }>
  >({});

  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accounts } = useTelegram();

  //debugger;
  useEffect(() => {
    if (!selectedChatKey) return;

    const { platform, accountId, chatId } = parseChatKey(selectedChatKey);
    if (platform !== "telegram") return;

    const chat = chatsByAccount[accountId]?.[selectedChatKey];
    if (!chat) return;

    // VALIDATION (should not happen)
    if (!chat.peerType) return;

    telegramApi.getMessageHistory({
      accountId,
      peerType: chat.peerType,
      peerId: chat.chatId,
      accessHash: chat.accessHash ?? null,
    });
  }, [selectedChatKey]);

  /* ===== SOCKET EVENTS ===== */
  useEffect(() => {
    if (!accounts?.length) return;

    const updateAccountChats = (
      accountId: string,
      newData: Record<string, UnifiedChat>
    ) => {
      setChatsByAccount((prev) => {
        const updated = { ...(prev[accountId] || {}), ...newData };
        return { ...prev, [accountId]: sortChats(updated) };
      });
    };

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

        const updatedChat: UnifiedChat = {
          ...baseChat,
          lastMessage: {
            ...data.message,
            type: "text",
            from: {
              id: data.message.from.id,
              name: data.message.from.name,
            },
          },

          unreadCount: newUnreadCount,
        };
        // Remove all typing indicators in this chat
        setTypingByChat((prev) => {
          const copy = { ...prev };
          delete copy[chatKey];
          return copy;
        });
        const merged = { ...accountChats, [chatKey]: updatedChat };
        return { ...prev, [data.accountId]: sortChats(merged) };
      });
    };

    const handleMessageEdited = (data: TelegramMessageEditedPayload) => {
      console.log("Handle message edited", data);
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

        // Only update if the edited message is the last message
        const lastId = String(existing.lastMessage.id);
        const editedId = String(data.messageId);
        if (lastId !== editedId) return prev;

        const updatedChat: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: data.newText,
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
      console.log("Handle message deleted", data);
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
        const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
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
        const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
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
        const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
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
    socketClient.on("telegram:typing", handleTyping);
    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_edited", handleMessageEdited);
    socketClient.on("telegram:message_deleted", handleMessageDeleted);
    socketClient.on("telegram:read_updates", handleReadUpdates);
    socketClient.on("telegram:message_views", handleMessageViews);
    socketClient.on("telegram:pinned_messages", handlePinnedMessages);
    socketClient.on("telegram:account_status", handleAccountStatus);

    return () => {
      socketClient.off("telegram:typing", handleTyping);
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_edited", handleMessageEdited);
      socketClient.off("telegram:message_deleted", handleMessageDeleted);
      socketClient.off("telegram:read_updates", handleReadUpdates);
      socketClient.off("telegram:message_views", handleMessageViews);
      socketClient.off("telegram:pinned_messages", handlePinnedMessages);
      socketClient.off("telegram:account_status", handleAccountStatus);
      socketClient.off("telegram:typing", handleTyping);
      for (const key of Object.keys(typingTimeouts.current)) {
        clearTimeout(typingTimeouts.current[key]);
      }
      typingTimeouts.current = {};
    };
  }, [accounts?.length]);
  /* ===== TYPING INDICATORS ===== */

  const handleTyping = (data: TelegramTypingPayload) => {
    const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
    const userKey = `${chatKey}:${data.userId}`;

    // if "stopped typing" event received — remove immediately
    if (!data.isTyping) {
      if (typingTimeouts.current[userKey]) {
        clearTimeout(typingTimeouts.current[userKey]);
        delete typingTimeouts.current[userKey];
      }

      setTypingByChat((prev) => {
        const existing = prev[chatKey]?.users ?? [];
        const filtered = existing.filter((u) => u.id !== data.userId);

        if (filtered.length === 0) {
          const copy = { ...prev };
          delete copy[chatKey];
          return copy;
        }

        return { ...prev, [chatKey]: { users: filtered } };
      });

      return;
    }

    // isTyping === true → add / update
    setTypingByChat((prev) => {
      const existing = prev[chatKey]?.users ?? [];
      const filtered = existing.filter((u) => u.id !== data.userId);
      const updated = [...filtered, { id: data.userId, name: data.username }];
      return { ...prev, [chatKey]: { users: updated } };
    });

    // restart the timer
    if (typingTimeouts.current[userKey]) {
      clearTimeout(typingTimeouts.current[userKey]);
    }

    typingTimeouts.current[userKey] = setTimeout(() => {
      setTypingByChat((prev) => {
        const existing = prev[chatKey]?.users ?? [];
        const filtered = existing.filter((u) => u.id !== data.userId);

        if (filtered.length === 0) {
          const copy = { ...prev };
          delete copy[chatKey];
          return copy;
        }

        return { ...prev, [chatKey]: { users: filtered } };
      });

      delete typingTimeouts.current[userKey];
    }, 5000);
  };

  /* ===== FETCH DIALOGS ===== */
  const fetchDialogs = async (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => {
    if (!accountId) return;
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

        newChats[chatKey] = {
          ...chat,
          platform,
          accountId,
          lastMessage: chat.lastMessage
            ? {
                ...chat.lastMessage,
                type: chat.lastMessage.type || "text",
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

  /* ===== FETCH MORE ===== */
  const fetchMoreDialogs = async (
    platform: UnifiedChatPlatform,
    accountId: string
  ) => {
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
        const chatKey = `${platform}:${accountId}:${chat.chatId}`;
        newChats[chatKey] = {
          platform,
          accountId,
          chatId: chat.chatId,
          title: chat.displayName || chat.title,
          lastMessage: chat.lastMessage
            ? { ...chat.lastMessage, type: chat.lastMessage.type || "text" }
            : undefined,
          unreadCount: chat.unreadCount || 0,
          pinned: chat.pinned || false,
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

  const selectChat = (chatKey: string | null) => setSelectedChatKey(chatKey);

  // Optimistic lastMessage update for outgoing pending messages
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

      const updatedChat: UnifiedChat = {
        ...existing,
        lastMessage: {
          id: String(message.messageId),
          text: message.text,
          type: "text",
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
