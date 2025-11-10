// frontend/src/context/UnifiedDialogsContext.tsx
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

  // === Realtime Telegram events ===
  useEffect(() => {
    // TEMP: for now we handle only text-based messages
    function handleNewMessage(data: TelegramNewMessagePayload) {
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
          lastMessage: { ...data.message, type: "text" }, // TEMP: raw message until media support is added
          unreadCount: existing ? (existing.unreadCount || 0) + 1 : 1,
        };

        return { ...prev, [chatKey]: updated };
      });
    }

    function handleMessageEdited(data: TelegramMessageEditedPayload) {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing?.lastMessage) return prev;
        if (existing.lastMessage.id !== data.messageId) return prev;

        const updated: UnifiedChat = {
          ...existing,
          lastMessage: {
            ...existing.lastMessage,
            text: data.newText,
          },
        };
        return { ...prev, [chatKey]: updated };
      });
    }

    function handleMessageDeleted(data: TelegramMessageDeletedPayload) {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing) return prev;

        if (
          existing.lastMessage &&
          data.messageIds.includes(existing.lastMessage.id)
        ) {
          // TEMP: clear preview, later will handle media properly
          const updated = { ...existing, lastMessage: undefined };
          return { ...prev, [chatKey]: updated };
        }
        return prev;
      });
    }

    function handleReadUpdates(data: TelegramReadUpdatesPayload) {
      const chatKey = `${data.platform}:${data.accountId}:${data.chatId}`;
      setChatsByKey((prev) => {
        const existing = prev[chatKey];
        if (!existing) return prev;
        return { ...prev, [chatKey]: { ...existing, unreadCount: 0 } };
      });
    }

    // TEMP: typing updates will be visualized later in UI
    function handleTyping(_: TelegramTypingPayload) {}

    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_edited", handleMessageEdited);
    socketClient.on("telegram:message_deleted", handleMessageDeleted);
    socketClient.on("telegram:read_updates", handleReadUpdates);
    socketClient.on("telegram:typing", handleTyping);

    return () => {
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_edited", handleMessageEdited);
      socketClient.off("telegram:message_deleted", handleMessageDeleted);
      socketClient.off("telegram:read_updates", handleReadUpdates);
      socketClient.off("telegram:typing", handleTyping);
    };
  }, []);

  // === Chat selection ===
  function selectChat(chatKey: string | null) {
    setSelectedChatKey(chatKey);
  }

  // === Fetch dialogs (initial load) ===
  const fetchDialogs = async (platform: string, accountId: string) => {
    if (!accountId) return;
    try {
      setLoading(true);
      const res = await telegramApi.getLatestDialogs(accountId);

      // TEMP: store next offset for pagination
      setNextOffsetByAccount((prev) => ({
        ...prev,
        [accountId]: res.nextOffset || null,
      }));

      const newChatsByKey: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        console.log("Fetched chat:", chat);
        const chatKey = `${platform}:${accountId}:${chat.chatId}`;
        newChatsByKey[chatKey] = {
          platform: "telegram", // TEMP: hardcoded for now
          accountId,
          chatId: chat.chatId,
          title: chat.displayName || chat.title,
          lastMessage: { ...chat.lastMessage, type: "text" }, // TEMP: raw from backend
          unreadCount: chat.unreadCount || 0,
        };
      }

      setChatsByKey((prev) => ({ ...prev, ...newChatsByKey }));
    } catch (err) {
      console.error("Failed to fetch dialogs", err);
      setError("Failed to load dialogs");
    } finally {
      setLoading(false);
    }
  };

  // === Fetch more dialogs (pagination) ===
  const fetchMoreDialogs = async (platform: string, accountId: string) => {
    const nextOffset = nextOffsetByAccount[accountId];
    console.log("Fetching more dialogs with offsets:", nextOffsetByAccount);
    if (!nextOffset) return;
    console.log("Fetching more dialogs with offset:", nextOffset);
    try {
      setLoading(true);
      const res = await telegramApi.getDialogs(accountId, nextOffset);

      const newChatsByKey: Record<string, UnifiedChat> = {};
      for (const chat of res.dialogs) {
        const chatKey = `${platform}:${accountId}:${chat.chatId}`;
        newChatsByKey[chatKey] = {
          platform: "telegram", // TEMP: hardcoded for now
          accountId,
          chatId: chat.chatId,
          title: chat.displayName || chat.title,
          lastMessage: { ...chat.lastMessage, type: "text" }, // TEMP: raw from backend
          unreadCount: chat.unreadCount || 0,
        };
      }
      setChatsByKey((prev) => ({ ...prev, ...newChatsByKey }));
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

  // === Context value ===
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
  if (!ctx) throw new Error("useUnifiedDialogs must be used within provider");
  return ctx;
};
