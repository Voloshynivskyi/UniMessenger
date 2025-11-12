import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { UnifiedChat } from "../types/unifiedChat.types";
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

interface UnifiedDialogsContextType {
  chatsByKey: Record<string, UnifiedChat>;
  selectedChatKey: string | null;
  loading: boolean;
  error: string | null;
  fetchDialogs: (platform: string, accountId: string) => Promise<void>;
  fetchMoreDialogs: (platform: string, accountId: string) => Promise<void>;
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
  const [chatsByKey, setChatsByKey] = useState<Record<string, UnifiedChat>>({});
  const [nextOffsetByAccount, setNextOffsetByAccount] = useState<
    Record<string, any | null>
  >({});
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ===== SOCKET EVENT HANDLERS =====
    const handleNewMessage = (data: TelegramNewMessagePayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        const updated: UnifiedChat = {
          ...(existing || {
            platform: data.platform,
            accountId: data.accountId,
            chatId: data.chatId,
            title: data.message.from.name || "Unknown chat",
          }),
          lastMessage: { ...data.message, type: "text" },
          unreadCount: existing ? (existing.unreadCount || 0) + 1 : 1,
        };
        return { ...prev, [chatKey]: updated };
      });
    };

    const handleMessageEdited = (data: TelegramMessageEditedPayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing?.lastMessage) return prev;
        if (existing.lastMessage.id !== data.messageId) return prev;
        return {
          ...prev,
          [chatKey]: {
            ...existing,
            lastMessage: { ...existing.lastMessage, text: data.newText },
          },
        };
      });
    };

    const handleMessageDeleted = (data: TelegramMessageDeletedPayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing) return prev;
        if (
          existing.lastMessage &&
          data.messageIds.includes(existing.lastMessage.id)
        ) {
          const updated = { ...existing, lastMessage: undefined };
          return { ...prev, [chatKey]: updated };
        }
        return prev;
      });
    };

    const handleReadUpdates = (data: TelegramReadUpdatesPayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      console.log("[FRONT] read_updates:", data);
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing) return prev;
        return { ...prev, [chatKey]: { ...existing, unreadCount: 0 } };
      });
    };

    const handleMessageViews = (data: TelegramMessageViewPayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing?.lastMessage) return prev;
        if (existing.lastMessage.id !== data.messageId) return prev;
        return {
          ...prev,
          [chatKey]: {
            ...existing,
            lastMessage: { ...existing.lastMessage, views: data.views },
          },
        };
      });
    };

    const handlePinnedMessages = (data: TelegramPinnedMessagesPayload) => {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing) return prev;
        return { ...prev, [chatKey]: { ...existing, pinned: data.pinned } };
      });
    };

    const handleAccountStatus = (data: TelegramAccountStatusPayload) => {
      console.log(`[Account ${data.accountId}] Status: ${data.status}`);
    };

    const handleTyping = (data: TelegramTypingPayload) => {
      console.debug("Typing:", data);
    };

    // ===== SOCKET BINDINGS =====
    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_edited", handleMessageEdited);
    socketClient.on("telegram:message_deleted", handleMessageDeleted);
    socketClient.on("telegram:read_updates", handleReadUpdates);
    socketClient.on("telegram:typing", handleTyping);
    socketClient.on("telegram:message_views", handleMessageViews);
    socketClient.on("telegram:pinned_messages", handlePinnedMessages);
    socketClient.on("telegram:account_status", handleAccountStatus);

    return () => {
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_edited", handleMessageEdited);
      socketClient.off("telegram:message_deleted", handleMessageDeleted);
      socketClient.off("telegram:read_updates", handleReadUpdates);
      socketClient.off("telegram:typing", handleTyping);
      socketClient.off("telegram:message_views", handleMessageViews);
      socketClient.off("telegram:pinned_messages", handlePinnedMessages);
      socketClient.off("telegram:account_status", handleAccountStatus);
    };
  }, []);

  // ===== SELECT CHAT =====
  const selectChat = (chatKey: string | null) => setSelectedChatKey(chatKey);

  // ===== FETCH DIALOGS =====
  const fetchDialogs = async (platform: string, accountId: string) => {
    if (!accountId) return;
    try {
      setLoading(true);
      const res = await telegramApi.getLatestDialogs(accountId);
      setNextOffsetByAccount((prev) => ({
        ...prev,
        [accountId]: res.nextOffset || null,
      }));

      const newChats: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        const chatKey = `${platform}:${accountId}:${chat.chatId}`;
        newChats[chatKey] = {
          platform: "telegram",
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
      setChatsByKey((prev) => ({ ...prev, ...newChats }));
    } catch (err) {
      console.error("Failed to fetch dialogs", err);
      setError("Failed to load dialogs");
    } finally {
      setLoading(false);
    }
  };

  // ===== FETCH MORE =====
  const fetchMoreDialogs = async (platform: string, accountId: string) => {
    const nextOffset = nextOffsetByAccount[accountId];
    if (!nextOffset) return;
    try {
      setLoading(true);
      const res = await telegramApi.getDialogs(accountId, nextOffset);
      const newChats: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        const chatKey = `${platform}:${accountId}:${chat.chatId}`;
        newChats[chatKey] = {
          platform: "telegram",
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
      setChatsByKey((prev) => ({ ...prev, ...newChats }));
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

  const value: UnifiedDialogsContextType = {
    chatsByKey,
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
