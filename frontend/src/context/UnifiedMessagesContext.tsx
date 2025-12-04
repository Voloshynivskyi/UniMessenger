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
  type TelegramMessageConfirmedPayload,
} from "../realtime/events";

import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type { MessageStatus } from "../types/unifiedMessage.types";

import { buildChatKey } from "../pages/inbox/utils/chatUtils";

const INITIAL_KEEP = 40;
const PAGE_SIZE = 20;

function asUnified(m: any): UnifiedTelegramMessage {
  return m as UnifiedTelegramMessage;
}

/* --------------------------------------------------------- */
/* Helpers */
/* --------------------------------------------------------- */

function normalizeDateToISO(d: any): string {
  if (!d) return new Date().toISOString();

  if (typeof d === "string") {
    const t = new Date(d).getTime();
    return isNaN(t) ? new Date().toISOString() : d;
  }

  if (typeof d === "number") {
    return new Date(d).toISOString();
  }

  const t = new Date(d).getTime();
  return isNaN(t) ? new Date().toISOString() : new Date(d).toISOString();
}

function getTimestampSafe(msg: UnifiedTelegramMessage): number {
  const t = new Date(msg.date).getTime();
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

/* --------------------------------------------------------- */
/* Types */
/* --------------------------------------------------------- */

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

  addOrUpdateMessage: (chatKey: string, msg: UnifiedTelegramMessage) => void;

  removeMessage: (chatKey: string, id: string | number) => void;

  clearChatState: (chatKey: string) => void;
  clearAll: () => void;
}

/* --------------------------------------------------------- */
/* Context */
/* --------------------------------------------------------- */

const UnifiedMessagesContext = createContext<
  UnifiedMessagesContextValue | undefined
>(undefined);

/* --------------------------------------------------------- */
/* Provider */
/* --------------------------------------------------------- */

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

  /* --------------------------------------------------------- */
  /* Load newest N messages */
  /* --------------------------------------------------------- */

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

        const normalized = response.messages.map((m) => ({
          ...m,
          date: normalizeDateToISO(m.date),
          status: "sent" as MessageStatus,
          tempId: null,
        }));

        const sorted = normalized.sort(sortAsc);
        const latest = sorted.slice(-INITIAL_KEEP);

        setMessagesByChat((prev) => ({
          ...prev,
          [chatKey]: dedupe(latest).sort(sortAsc),
        }));

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
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch messages");
      } finally {
        setChatLoading(chatKey, false);
      }
    },
    [loadingByChat, setChatLoading]
  );

  /* --------------------------------------------------------- */
  /* Pagination */
  /* --------------------------------------------------------- */

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

      const offset = nextOffsetByChat[chatKey] ?? current[0]?.messageId;
      if (!offset) {
        setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
        return;
      }

      setChatLoading(chatKey, true);

      try {
        const response = (await telegramApi.getMessageHistory({
          accountId,
          peerType,
          peerId,
          accessHash,
          limit: PAGE_SIZE,
          offsetId: Number(offset),
        })) as GetMessageHistoryResponse;

        const older = response.messages.map((m) => ({
          ...m,
          date: normalizeDateToISO(m.date),
        }));

        if (older.length === 0) {
          setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
          return;
        }

        const merged = dedupe([...older, ...current]).sort(sortAsc);

        setMessagesByChat((prev) => ({ ...prev, [chatKey]: merged }));

        setNextOffsetByChat((prev) => ({
          ...prev,
          [chatKey]: response.nextOffsetId ?? null,
        }));

        setFullyLoadedByChat((prev) => ({
          ...prev,
          [chatKey]: !response.nextOffsetId,
        }));
      } finally {
        setChatLoading(chatKey, false);
      }
    },
    [
      messagesByChat,
      loadingByChat,
      fullyLoadedByChat,
      nextOffsetByChat,
      fetchMessages,
    ]
  );

  /* --------------------------------------------------------- */
  /* Add or update message (optimistic OR real) */
  /* --------------------------------------------------------- */

  const addOrUpdateMessage = useCallback(
    (chatKey: string, msg: UnifiedTelegramMessage) => {
      const normalized = {
        ...msg,
        date: normalizeDateToISO(msg.date),
      };

      setMessagesByChat((prev) => {
        const current = prev[chatKey] ?? [];

        // 1) If optimistic (tempId exists)
        if (msg.tempId) {
          const exists = current.some((m) => m.tempId === msg.tempId);
          if (exists) {
            const updated = current.map((m) =>
              m.tempId === msg.tempId ? normalized : m
            );
            return {
              ...prev,
              [chatKey]: dedupe(updated).sort(sortAsc),
            };
          }

          const merged = dedupe([...current, normalized]).sort(sortAsc);
          return { ...prev, [chatKey]: merged };
        }

        // 2) If not optimistic → replace OR add
        const updated = current.map((m) =>
          String(m.messageId) === String(msg.messageId) ? normalized : m
        );
        const merged = dedupe([...updated, normalized]).sort(sortAsc);

        return { ...prev, [chatKey]: merged };
      });
    },
    []
  );

  /* --------------------------------------------------------- */
  /* Remove message */
  /* --------------------------------------------------------- */

  const removeMessage = useCallback((chatKey: string, id: string | number) => {
    const idStr = String(id);
    setMessagesByChat((prev) => {
      const current = prev[chatKey] ?? [];
      return {
        ...prev,
        [chatKey]: current.filter((m) => String(m.messageId) !== idStr),
      };
    });
  }, []);

  /* --------------------------------------------------------- */
  /* Cleanup */
  /* --------------------------------------------------------- */

  const clearChatState = useCallback((chatKey: string) => {
    setMessagesByChat((prev) => {
      const current = prev[chatKey] ?? [];
      if (current.length <= INITIAL_KEEP) return prev;

      const sorted = [...current].sort(sortAsc);
      return {
        ...prev,
        [chatKey]: sorted.slice(-INITIAL_KEEP),
      };
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

  /* --------------------------------------------------------- */
  /* SOCKET HANDLERS
     The MOST IMPORTANT PART for stability
  --------------------------------------------------------- */

  useEffect(() => {
    if (!socketClient) return;

    /* NEW MESSAGE — replaces optimistic with TRUE backend payload */
    const handleNewMessage = (p: TelegramNewMessagePayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);

      const raw = p.message;

      const msg: UnifiedTelegramMessage = asUnified({
        ...raw,
        platform: "telegram",
        accountId: p.accountId,
        chatId: String(p.chatId),
        messageId: String(raw.messageId),
        tempId: null,
        status: "sent",
        date: normalizeDateToISO(raw.date),
      });

      addOrUpdateMessage(chatKey, msg);
    };

    /* CONFIRMED — FULL REPLACEMENT OF OPTIMISTIC MESSAGE */
    const handleConfirmed = (p: TelegramMessageConfirmedPayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        const real = p.message; // ← full unified parsed message

        const updated = list.map((m) => {
          if (m.tempId != null && String(m.tempId) === String(p.tempId)) {
            return asUnified({
              ...real,
              status: "sent",
              tempId: null,
              date: normalizeDateToISO(real.date),
            });
          }
          return m;
        });

        return {
          ...prev,
          [chatKey]: dedupe(updated).sort(sortAsc),
        };
      });
    };

    /* EDITED */
    const handleEdited = (p: TelegramMessageEditedPayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        return {
          ...prev,
          [chatKey]: list.map((m) =>
            String(m.messageId) === String(p.messageId)
              ? { ...m, text: p.newText }
              : m
          ),
        };
      });
    };

    /* DELETED */
    const handleDeleted = (p: TelegramMessageDeletedPayload) => {
      if (p.platform !== "telegram") return;

      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);
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

    /* Bind */
    socketClient.on("telegram:new_message", handleNewMessage);
    socketClient.on("telegram:message_confirmed", handleConfirmed);
    socketClient.on("telegram:message_edited", handleEdited);
    socketClient.on("telegram:message_deleted", handleDeleted);

    return () => {
      socketClient.off("telegram:new_message", handleNewMessage);
      socketClient.off("telegram:message_confirmed", handleConfirmed);
      socketClient.off("telegram:message_edited", handleEdited);
      socketClient.off("telegram:message_deleted", handleDeleted);
    };
  }, [addOrUpdateMessage]);

  /* --------------------------------------------------------- */

  return (
    <UnifiedMessagesContext.Provider
      value={{
        messagesByChat,
        loadingByChat,
        loading,
        fetchedByChat,
        fullyLoadedByChat,
        error,
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
  if (!ctx)
    throw new Error("useMessages must be used inside UnifiedMessagesProvider");
  return ctx;
};
