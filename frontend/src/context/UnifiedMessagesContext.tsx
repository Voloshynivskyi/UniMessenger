// frontend/src/context/UnifiedMessagesContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { telegramApi } from "../api/telegramApi";
import { socketClient } from "../realtime/socketClient";
import {
  type TelegramNewMessagePayload,
  type TelegramMessageEditedPayload,
  type TelegramMessageDeletedPayload,
} from "../realtime/events";

import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type { MessageStatus } from "../types/unifiedMessage.types";

const INITIAL_KEEP = 50;
const PAGE_SIZE = 25;

export interface FetchMessagesArgs {
  chatKey: string;
  accountId: string;
  peerType: "user" | "chat" | "channel";
  peerId: string | number | bigint;
  accessHash?: string | number | bigint | null;
}

interface GetMessageHistoryResponse {
  messages: UnifiedTelegramMessage[];
  nextOffsetId?: number | null;
}

interface UnifiedMessagesContextValue {
  messagesByChat: Record<string, UnifiedTelegramMessage[]>;
  loadingByChat: Record<string, boolean>;
  loading: boolean;
  fetchedByChat: Record<string, boolean>;
  fullyLoadedByChat: Record<string, boolean>;
  error: string | null;

  fetchMessages: (args: FetchMessagesArgs) => Promise<void>;
  fetchOlderMessages: (args: FetchMessagesArgs) => Promise<void>;

  addOrUpdateMessage: (
    chatKey: string,
    message: UnifiedTelegramMessage
  ) => void;
  sendTelegramMessage: (data: {
    accountId: string;
    chatId: string;
    text: string;
    tempId: string | number;
    peerType?: "user" | "chat" | "channel";
    accessHash?: string | number | bigint | null;
  }) => void;
  removeMessage: (chatKey: string, id: string | number) => void;

  clearChatState: (chatKey: string) => void;
  clearAll: () => void;
}

const UnifiedMessagesContext = createContext<
  UnifiedMessagesContextValue | undefined
>(undefined);

/* -------------------------------------------------------------------------- */
/* utils */
/* -------------------------------------------------------------------------- */

function buildChatKey(
  platform: string,
  accountId: string,
  chatId: string | number | bigint
) {
  return `${platform}:${accountId}:${String(chatId)}`;
}

// Normalize any date to ISO string
function normalizeDateToISO(d: any): string {
  if (!d) return new Date().toISOString();

  // if already ISO/string
  if (typeof d === "string") {
    const t = new Date(d).getTime();
    return isNaN(t) ? new Date().toISOString() : d;
  }

  // if number (assume ms)
  if (typeof d === "number") {
    const t = new Date(d).getTime();
    return isNaN(t) ? new Date().toISOString() : new Date(d).toISOString();
  }

  // fallback
  const t = new Date(d).getTime();
  return isNaN(t) ? new Date().toISOString() : new Date(d).toISOString();
}

function getTimestampSafe(msg: UnifiedTelegramMessage): number {
  const t = new Date(msg.date as any).getTime();
  return isNaN(t) ? 0 : t;
}

function sortAsc(a: UnifiedTelegramMessage, b: UnifiedTelegramMessage) {
  return getTimestampSafe(a) - getTimestampSafe(b);
}

function dedupe(list: UnifiedTelegramMessage[]) {
  const seen = new Set<string>();
  const out: UnifiedTelegramMessage[] = [];

  for (const m of list) {
    const id = String(m.messageId);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(m);
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* provider */
/* -------------------------------------------------------------------------- */

export const UnifiedMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [messagesByChat, setMessagesByChat] = useState<
    Record<string, UnifiedTelegramMessage[]>
  >({});
  const [loadingByChat, setLoadingByChat] = useState<Record<string, boolean>>(
    {}
  );
  const [fetchedByChat, setFetchedByChat] = useState<Record<string, boolean>>(
    {}
  );
  const [fullyLoadedByChat, setFullyLoadedByChat] = useState<
    Record<string, boolean>
  >({});
  const [nextOffsetByChat, setNextOffsetByChat] = useState<
    Record<string, number | null>
  >({});
  const [error, setError] = useState<string | null>(null);

  const setChatLoading = useCallback((chatKey: string, flag: boolean) => {
    setLoadingByChat((prev) => ({ ...prev, [chatKey]: flag }));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Initial fetch */
  /* ---------------------------------------------------------------------- */

  const fetchMessages = useCallback(
    async ({
      chatKey,
      accountId,
      peerType,
      peerId,
      accessHash,
    }: FetchMessagesArgs) => {
      if (loadingByChat[chatKey]) return;

      setChatLoading(chatKey, true);
      setError(null);

      try {
        const response = (await telegramApi.getMessageHistory({
          accountId,
          peerType,
          peerId,
          accessHash,
          limit: INITIAL_KEEP,
        })) as GetMessageHistoryResponse;

        // Normalize dates
        const normalized = response.messages.map((m) => ({
          ...m,
          date: normalizeDateToISO(m.date),
          status: "sent" as MessageStatus,
          tempId: null,
        }));

        const sorted = [...normalized].sort(sortAsc);
        const latest = sorted.slice(-INITIAL_KEEP);

        setMessagesByChat((prev) => {
          const current = prev[chatKey] ?? [];
          const merged = dedupe([...current, ...latest]).sort(sortAsc);
          return {
            ...prev,
            [chatKey]: merged,
          };
        });

        setNextOffsetByChat((prev) => ({
          ...prev,
          [chatKey]: response.nextOffsetId ?? null,
        }));

        setFullyLoadedByChat((prev) => ({
          ...prev,
          [chatKey]: !response.nextOffsetId,
        }));

        setFetchedByChat((prev) => ({
          ...prev,
          [chatKey]: true,
        }));
      } catch (err: any) {
        setError(err?.message ?? "Failed to fetch messages");
      } finally {
        setChatLoading(chatKey, false);
      }
    },
    [loadingByChat, setChatLoading]
  );

  /* ---------------------------------------------------------------------- */
  /* Pagination: fetch older */
  /* ---------------------------------------------------------------------- */

  const fetchOlderMessages = useCallback(
    async ({
      chatKey,
      accountId,
      peerType,
      peerId,
      accessHash,
    }: FetchMessagesArgs) => {
      if (fullyLoadedByChat[chatKey]) return;
      if (loadingByChat[chatKey]) return;

      const current = messagesByChat[chatKey] ?? [];
      if (current.length === 0) {
        await fetchMessages({
          chatKey,
          accountId,
          peerType,
          peerId,
          accessHash,
        });
        return;
      }

      const offset = nextOffsetByChat[chatKey];
      const fallbackOffset = current[0]?.messageId;

      const offsetId = offset ?? fallbackOffset;
      if (!offsetId) {
        setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
        return;
      }

      setChatLoading(chatKey, true);
      setError(null);

      try {
        const response = (await telegramApi.getMessageHistory({
          accountId,
          peerType,
          peerId,
          accessHash,
          limit: PAGE_SIZE,
          offsetId: Number(offsetId),
        })) as GetMessageHistoryResponse;

        const olderRaw = response.messages ?? [];
        const older = olderRaw.map((m) => ({
          ...m,
          date: normalizeDateToISO(m.date),
        }));

        if (!older.length) {
          setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
          return;
        }

        const merged = dedupe([...older, ...current]).sort(sortAsc);

        setMessagesByChat((prev) => ({
          ...prev,
          [chatKey]: merged,
        }));

        setNextOffsetByChat((prev) => ({
          ...prev,
          [chatKey]: response.nextOffsetId ?? null,
        }));

        setFullyLoadedByChat((prev) => ({
          ...prev,
          [chatKey]: !response.nextOffsetId,
        }));
      } catch (err: any) {
        setError(err?.message ?? "Failed to fetch older messages");
      } finally {
        setChatLoading(chatKey, false);
      }
    },
    [
      fetchMessages,
      messagesByChat,
      loadingByChat,
      fullyLoadedByChat,
      nextOffsetByChat,
      setChatLoading,
    ]
  );

  /* ---------------------------------------------------------------------- */
  /* Insert new or update existing */
  /* ---------------------------------------------------------------------- */

  const addOrUpdateMessage = useCallback(
    (chatKey: string, msg: UnifiedTelegramMessage) => {
      const normalizedMsg = {
        ...msg,
        date: normalizeDateToISO(msg.date),
      };

      setMessagesByChat((prev) => {
        const current = prev[chatKey] ?? [];

        // if there is a tempId → find and replace by tempId
        if (normalizedMsg.tempId) {
          const updated = current.map((m) =>
            m.tempId && m.tempId === normalizedMsg.tempId ? normalizedMsg : m
          );
          const merged = dedupe([...updated, normalizedMsg]).sort(sortAsc);
          return { ...prev, [chatKey]: merged };
        }

        // if real message exists replace messageId
        const merged = dedupe([...current, normalizedMsg]).sort(sortAsc);
        return { ...prev, [chatKey]: merged };
      });
    },
    []
  );
  /* ---------------------------------------------------------------------- */
  /* Send message to backend (tempId is used for optimistic matching) */
  /* ---------------------------------------------------------------------- */

  const sendTelegramMessage = useCallback(
    (data: {
      accountId: string;
      chatId: string;
      text: string;
      tempId: string | number;
      peerType?: "user" | "chat" | "channel";
      accessHash?: string | number | bigint | null;
    }) => {
      if (!socketClient) return;
      console.log(
        "[FRONT] ➡️ Emitting telegram:send_message",
        JSON.stringify(data, null, 2)
      );

      socketClient.emit("telegram:send_message", data as any);
    },
    []
  );
  /* ---------------------------------------------------------------------- */
  /* Remove message */
  /* ---------------------------------------------------------------------- */
  const removeMessage = useCallback((chatKey: string, id: string | number) => {
    const idStr = String(id);
    setMessagesByChat((prev) => {
      const current = prev[chatKey] ?? [];
      const filtered = current.filter((m) => String(m.messageId) !== idStr);
      return { ...prev, [chatKey]: filtered };
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Cleanup per chat */
  /* ---------------------------------------------------------------------- */

  const clearChatState = useCallback((chatKey: string) => {
    setMessagesByChat((prev) => {
      const current = prev[chatKey];
      if (!current || current.length <= INITIAL_KEEP) return prev;

      const sorted = [...current].sort(sortAsc);
      const latest = sorted.slice(-INITIAL_KEEP);

      return { ...prev, [chatKey]: latest };
    });

    setNextOffsetByChat((prev) => {
      const { [chatKey]: _, ...rest } = prev;
      return rest;
    });

    setFullyLoadedByChat((prev) => {
      const { [chatKey]: _, ...rest } = prev;
      return rest;
    });

    setFetchedByChat((prev) => {
      const { [chatKey]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAll = useCallback(() => {
    setMessagesByChat({});
    setLoadingByChat({});
    setFetchedByChat({});
    setFullyLoadedByChat({});
    setNextOffsetByChat({});
    setError(null);
  }, []);

  const loading = Object.values(loadingByChat).some(Boolean);

  /* ---------------------------------------------------------------------- */
  /* SOCKET HANDLERS */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!socketClient) return;

    /* ==========================================================
     NEW MESSAGE
     ========================================================== */
    const handleNewMessage = (p: TelegramNewMessagePayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey(p.platform, p.accountId, p.chatId);

      // backend already sends unified message
      const raw: UnifiedTelegramMessage = p.message;

      const msg: UnifiedTelegramMessage = {
        ...raw,
        platform: "telegram",
        accountId: p.accountId,
        chatId: String(p.chatId),

        // ensure correct formats
        messageId: String(raw.messageId),
        date: normalizeDateToISO(raw.date),

        status: raw.status ?? "sent",
        tempId: raw.tempId ?? null,
      };

      addOrUpdateMessage(chatKey, msg);
    };

    /* ==========================================================
     EDITED MESSAGE
     ========================================================== */
    const handleEdited = (p: TelegramMessageEditedPayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey(p.platform, p.accountId, p.chatId);
      const target = String(p.messageId);

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        return {
          ...prev,
          [chatKey]: list.map((m) =>
            String(m.messageId) === target ? { ...m, text: p.newText } : m
          ),
        };
      });
    };

    /* ==========================================================
     DELETED MESSAGE
     ========================================================== */
    const handleDeleted = (p: TelegramMessageDeletedPayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey(p.platform, p.accountId, p.chatId);
      const ids = new Set(p.messageIds.map(String));

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        return {
          ...prev,
          [chatKey]: list.filter((m) => !ids.has(String(m.messageId))),
        };
      });
    };

    /* ==========================================================
     SOCKET BINDINGS
     ========================================================== */
    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_confirmed", handleNewMessage as any);
    socketClient.on("telegram:message_edited", handleEdited);
    socketClient.on("telegram:message_deleted", handleDeleted);

    return () => {
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_confirmed", handleNewMessage as any);
      socketClient.off("telegram:message_edited", handleEdited);
      socketClient.off("telegram:message_deleted", handleDeleted);
    };
  }, [addOrUpdateMessage]);

  /* ---------------------------------------------------------------------- */

  return (
    <UnifiedMessagesContext.Provider
      value={{
        messagesByChat,
        loadingByChat,
        loading,
        fetchedByChat,
        fullyLoadedByChat,
        error,
        sendTelegramMessage,
        fetchMessages,
        fetchOlderMessages,
        addOrUpdateMessage,
        removeMessage,
        clearChatState,
        clearAll,
      }}
    >
      {children}
    </UnifiedMessagesContext.Provider>
  );
};

export const useMessages = () => {
  const ctx = useContext(UnifiedMessagesContext);
  if (!ctx) {
    throw new Error("useMessages must be used inside UnifiedMessagesProvider");
  }
  return ctx;
};
