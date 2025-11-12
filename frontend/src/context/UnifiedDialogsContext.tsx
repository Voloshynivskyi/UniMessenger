import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
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

/* 🧩 Сортування чатів (прикріплені завжди зверху, решта — за датою останнього повідомлення) */
function sortChats(
  chats: Record<string, UnifiedChat>
): Record<string, UnifiedChat> {
  const sortedEntries = Object.entries(chats).sort(([_, a], [__, b]) => {
    // 1️⃣ pinned чати завжди зверху
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // 2️⃣ За датою останнього повідомлення
    const dateA = new Date(a.lastMessage?.date || 0).getTime();
    const dateB = new Date(b.lastMessage?.date || 0).getTime();
    return dateB - dateA;
  });

  return Object.fromEntries(sortedEntries);
}

interface UnifiedDialogsContextType {
  chatsByAccount: Record<string, Record<string, UnifiedChat>>;
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
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accounts } = useTelegram();

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
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
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
          lastMessage: { ...data.message, type: "text" },
          unreadCount: newUnreadCount,
        };

        const merged = { ...accountChats, [chatKey]: updatedChat };
        return { ...prev, [data.accountId]: sortChats(merged) };
      });
    };

    const handleMessageEdited = (data: TelegramMessageEditedPayload) => {
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
            lastMessage: { ...existing.lastMessage, text: data.newText },
          },
        };
        return { ...prev, [data.accountId]: sortChats(updated) };
      });
    };

    const handleMessageDeleted = (data: TelegramMessageDeletedPayload) => {
      setChatsByAccount((prev) => {
        const accountChats = prev[data.accountId];
        if (!accountChats) return prev;
        const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
        const existing = accountChats[chatKey];
        if (
          existing?.lastMessage &&
          data.messageIds.includes(existing.lastMessage.id)
        ) {
          const updated = {
            ...accountChats,
            [chatKey]: { ...existing, lastMessage: undefined },
          };
          return { ...prev, [data.accountId]: sortChats(updated) };
        }
        return prev;
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

    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_edited", handleMessageEdited);
    socketClient.on("telegram:message_deleted", handleMessageDeleted);
    socketClient.on("telegram:read_updates", handleReadUpdates);
    socketClient.on("telegram:message_views", handleMessageViews);
    socketClient.on("telegram:pinned_messages", handlePinnedMessages);
    socketClient.on("telegram:account_status", handleAccountStatus);

    return () => {
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_edited", handleMessageEdited);
      socketClient.off("telegram:message_deleted", handleMessageDeleted);
      socketClient.off("telegram:read_updates", handleReadUpdates);
      socketClient.off("telegram:message_views", handleMessageViews);
      socketClient.off("telegram:pinned_messages", handlePinnedMessages);
      socketClient.off("telegram:account_status", handleAccountStatus);
    };
  }, [accounts?.length]);

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

  const value: UnifiedDialogsContextType = {
    chatsByAccount,
    selectedChatKey,
    loading,
    error,
    fetchDialogs,
    fetchMoreDialogs,
    selectChat,
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
