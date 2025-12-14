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
import { discordApi } from "../api/discordApi";
import { socketBus } from "../realtime/eventBus";

import {
  type TelegramNewMessagePayload,
  type TelegramMessageEditedPayload,
  type TelegramMessageDeletedPayload,
  type TelegramMessageConfirmedPayload,
} from "../realtime/events";

import type { UnifiedTelegramMessage } from "../types/telegram.types";
import type {
  UnifiedMessage,
  MessageStatus,
} from "../types/unifiedMessage.types";
import type { UnifiedDiscordMessage } from "../types/discord.types";

import { buildChatKey, parseChatKey } from "../pages/inbox/utils/chatUtils";

const INITIAL_KEEP = 30;
const PAGE_SIZE = 20;

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

function getTimestampSafe(msg: UnifiedMessage): number {
  const t = new Date(msg.date).getTime();
  return isNaN(t) ? 0 : t;
}

function sortAsc(a: UnifiedMessage, b: UnifiedMessage) {
  return getTimestampSafe(a) - getTimestampSafe(b);
}

function dedupe(list: UnifiedMessage[]) {
  const seen = new Set<string>();
  const out: UnifiedMessage[] = [];

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

  // ⬇️ optional, derived from chatKey if needed
  accountId?: string;

  // Telegram only
  peerType?: "user" | "chat" | "channel";
  peerId?: string | number | bigint;
  accessHash?: string | number | bigint | null;

  // Discord
  chatId?: string | number | bigint;
  platform?: "telegram" | "discord";
}

interface GetMessageHistoryResponse {
  messages: UnifiedTelegramMessage[];
  nextOffsetId?: number | null;
}

interface UnifiedMessagesContextValue {
  messagesByChat: Record<string, UnifiedMessage[]>;
  loadingByChat: Record<string, boolean>;
  loading: boolean;
  fetchedByChat: Record<string, boolean>;
  fullyLoadedByChat: Record<string, boolean>;
  error: string | null;

  fetchMessages: (args: FetchMessagesArgs) => Promise<void>;
  fetchOlderMessages: (args: FetchMessagesArgs) => Promise<void>;

  addOrUpdateMessage: (chatKey: string, msg: UnifiedMessage) => void;
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
    Record<string, UnifiedMessage[]>
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

  // offsetId (telegram) or beforeMessageId (discord)
  const [nextOffsetByChat, setNextOffsetByChat] = useState<
    Record<string, number | string | null>
  >({});

  const [error, setError] = useState<string | null>(null);

  const setChatLoading = useCallback((chatKey: string, flag: boolean) => {
    setLoadingByChat((prev) => ({ ...prev, [chatKey]: flag }));
  }, []);

  /* --------------------------------------------------------- */
  /* Load newest N messages (Telegram + Discord) */
  /* --------------------------------------------------------- */

  const fetchMessages = useCallback(
    async (args: FetchMessagesArgs) => {
      const {
        chatKey,
        accountId,
        peerType,
        peerId,
        accessHash,
        chatId,
        platform: explicitPlatform,
      } = args;

      if (loadingByChat[chatKey]) return;

      const { platform: parsedPlatform, chatId: parsedChatId } =
        parseChatKey(chatKey);

      const platform = explicitPlatform ?? parsedPlatform;

      setChatLoading(chatKey, true);
      setError(null);

      try {
        if (platform === "telegram") {
          if (!peerType || peerId == null) {
            setChatLoading(chatKey, false);
            return;
          }

          const response = (await telegramApi.getMessageHistory({
            accountId: String(accountId),
            peerType,
            peerId,
            accessHash,
            limit: INITIAL_KEEP,
          })) as GetMessageHistoryResponse;

          const normalized = response.messages.map((m) => ({
            ...m,
            platform: "telegram" as const,
            date: normalizeDateToISO(m.date),
            status: "sent" as MessageStatus,
            tempId: null,
          })) as UnifiedMessage[];

          const sorted = normalized.sort(sortAsc);
          const latest = sorted.slice(-INITIAL_KEEP);

          setMessagesByChat((prev) => ({
            ...prev,
            [chatKey]: dedupe(latest as UnifiedMessage[]).sort(sortAsc),
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
        } else if (platform === "discord") {
          const effectiveChatId = chatId ?? parsedChatId;
          if (!effectiveChatId) {
            setChatLoading(chatKey, false);
            return;
          }

          const { messages } = await discordApi.getHistory(
            String(accountId),
            String(effectiveChatId),
            { limit: PAGE_SIZE }
          );

          const normalized = messages.map((m: UnifiedDiscordMessage) => ({
            ...m,
            platform: "discord" as const,
            accountId: String(accountId),
            chatId: String(effectiveChatId),
            messageId: String(m.messageId),
            tempId: (m as any).tempId ?? null,
            status: ((m as any).status as MessageStatus) ?? "sent",
            date: normalizeDateToISO(m.date),
          })) as UnifiedMessage[];

          const sorted = dedupe(normalized).sort(sortAsc);

          setMessagesByChat((prev) => ({
            ...prev,
            [chatKey]: sorted,
          }));

          const oldest = sorted[0];
          setNextOffsetByChat((prev) => ({
            ...prev,
            [chatKey]: oldest ? String(oldest.messageId) : null,
          }));

          setFullyLoadedByChat((prev) => ({
            ...prev,
            [chatKey]: messages.length === 0,
          }));

          setFetchedByChat((prev) => ({
            ...prev,
            [chatKey]: true,
          }));
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch messages");
      } finally {
        setChatLoading(chatKey, false);
      }
    },
    [loadingByChat, setChatLoading]
  );

  /* --------------------------------------------------------- */
  /* Pagination — Telegram + Discord */
  /* --------------------------------------------------------- */

  const fetchOlderMessages = useCallback(
    async (args: FetchMessagesArgs) => {
      const { chatKey, accountId, peerType, peerId, accessHash } = args;

      const { platform, chatId: parsedChatId } = parseChatKey(chatKey);

      if (fullyLoadedByChat[chatKey]) return;
      if (loadingByChat[chatKey]) return;

      const current = messagesByChat[chatKey] ?? [];

      // If there is no history at all - do initial fetch
      if (current.length === 0) {
        await fetchMessages({
          ...args,
          platform: platform as "telegram" | "discord",
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
        if (platform === "telegram") {
          if (!peerType || peerId == null) {
            setChatLoading(chatKey, false);
            return;
          }

          const response = (await telegramApi.getMessageHistory({
            accountId: String(accountId),
            peerType,
            peerId,
            accessHash,
            limit: PAGE_SIZE,
            offsetId: Number(offset),
          })) as GetMessageHistoryResponse;

          const older = response.messages.map((m) => ({
            ...m,
            platform: "telegram" as const,
            date: normalizeDateToISO(m.date),
          })) as UnifiedMessage[];

          if (older.length === 0) {
            setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
            return;
          }

          const merged = dedupe([
            ...older,
            ...current,
          ] as UnifiedMessage[]).sort(sortAsc);

          setMessagesByChat((prev) => ({ ...prev, [chatKey]: merged }));

          setNextOffsetByChat((prev) => ({
            ...prev,
            [chatKey]: response.nextOffsetId ?? null,
          }));

          setFullyLoadedByChat((prev) => ({
            ...prev,
            [chatKey]: !response.nextOffsetId,
          }));
        } else if (platform === "discord") {
          const effectiveChatId = parsedChatId;
          if (!effectiveChatId) {
            setChatLoading(chatKey, false);
            return;
          }

          const { messages } = await discordApi.getHistory(
            String(accountId),
            String(effectiveChatId),
            {
              beforeMessageId: String(offset),
              limit: PAGE_SIZE,
            }
          );

          if (messages.length === 0) {
            setFullyLoadedByChat((prev) => ({ ...prev, [chatKey]: true }));
            return;
          }

          const older = messages.map((m: UnifiedDiscordMessage) => ({
            ...m,
            platform: "discord" as const,
            accountId: String(accountId),
            chatId: String(effectiveChatId),
            messageId: String(m.messageId),
            tempId: (m as any).tempId ?? null,
            status: ((m as any).status as MessageStatus) ?? "sent",
            date: normalizeDateToISO(m.date),
          })) as UnifiedMessage[];

          const merged = dedupe([
            ...older,
            ...current,
          ] as UnifiedMessage[]).sort(sortAsc);

          setMessagesByChat((prev) => ({ ...prev, [chatKey]: merged }));

          const oldest = merged[0];
          setNextOffsetByChat((prev) => ({
            ...prev,
            [chatKey]: oldest ? String(oldest.messageId) : null,
          }));

          setFullyLoadedByChat((prev) => ({
            ...prev,
            [chatKey]: messages.length === 0,
          }));
        }
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
      setChatLoading,
    ]
  );

  /* --------------------------------------------------------- */
  /* Add or update message (optimistic OR real) */
  /* --------------------------------------------------------- */

  const addOrUpdateMessage = useCallback(
    (chatKey: string, msg: UnifiedMessage) => {
      const normalized: UnifiedMessage = {
        ...msg,
        date: normalizeDateToISO(msg.date),
      };

      setMessagesByChat((prev) => {
        const current = prev[chatKey] ?? [];

        if (msg.tempId) {
          const exists = current.some((m) => m.tempId === msg.tempId);
          if (exists) {
            const updated = current.map((m) =>
              m.tempId === msg.tempId ? normalized : m
            );
            return {
              ...prev,
              [chatKey]: dedupe(updated as UnifiedMessage[]).sort(sortAsc),
            };
          }

          const merged = dedupe([
            ...current,
            normalized,
          ] as UnifiedMessage[]).sort(sortAsc);
          return { ...prev, [chatKey]: merged };
        }

        const updated = current.map((m) =>
          String(m.messageId) === String(msg.messageId) ? normalized : m
        );
        const merged = dedupe([
          ...updated,
          normalized,
        ] as UnifiedMessage[]).sort(sortAsc);

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
  /* SOCKET HANDLERS — TELEGRAM + DISCORD
  --------------------------------------------------------- */

  useEffect(() => {
    /* ---------------- TELEGRAM ---------------- */

    const handleNewMessage = (p: TelegramNewMessagePayload) => {
      if (p.platform !== "telegram") return;
      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);

      const raw = p.message as any;

      const msg: UnifiedMessage = {
        ...raw,
        platform: "telegram",
        accountId: p.accountId,
        chatId: String(p.chatId),
        messageId: String(raw.messageId),
        tempId: raw.tempId ?? null,
        status: "sent",
        date: normalizeDateToISO(raw.date),
      };

      addOrUpdateMessage(chatKey, msg);
    };

    const handleConfirmed = (p: TelegramMessageConfirmedPayload) => {
      if (p.platform !== "telegram") return;
      const chatKey = buildChatKey("telegram", p.accountId, p.chatId);

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        const real = p.message as any;
        const updated = list.map((m) =>
          m.tempId != null && String(m.tempId) === String(p.tempId)
            ? {
                ...real,
                platform: "telegram" as const,
                accountId: p.accountId,
                chatId: String(p.chatId),
                status: "sent" as MessageStatus,
                tempId: null,
                date: normalizeDateToISO(real.date),
              }
            : m
        );

        return {
          ...prev,
          [chatKey]: dedupe(updated as UnifiedMessage[]).sort(sortAsc),
        };
      });
    };

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

    /* ---------------- DISCORD ---------------- */

    const handleDiscordNew = (p: any) => {
      if (p.platform !== "discord") return;

      const chatKey = buildChatKey("discord", p.accountId, p.chatId);
      const raw = p.message as any;

      const msg: UnifiedMessage = {
        ...raw,
        platform: "discord",
        accountId: String(p.accountId),
        chatId: String(p.chatId),
        messageId: String(raw.messageId),
        tempId: raw.tempId ?? null,
        status: (raw.status as MessageStatus) ?? "sent",
        date: normalizeDateToISO(raw.date),
      };

      addOrUpdateMessage(chatKey, msg);
    };

    const handleDiscordEdited = (p: any) => {
      if (p.platform !== "discord") return;

      const chatKey = buildChatKey("discord", p.accountId, p.chatId);
      const updatedRaw = p.updated as any;

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        const updatedList = list.map((m) =>
          String(m.messageId) === String(p.messageId)
            ? ({
                ...m,
                ...updatedRaw,
                platform: "discord",
                accountId: String(p.accountId),
                chatId: String(p.chatId),
                date: normalizeDateToISO(updatedRaw.date ?? m.date),
                status: (updatedRaw.status as MessageStatus) ?? "sent",
              } as UnifiedMessage)
            : m
        );

        return {
          ...prev,
          [chatKey]: dedupe(updatedList as UnifiedMessage[]).sort(sortAsc),
        };
      });
    };

    const handleDiscordDeleted = (p: any) => {
      if (p.platform !== "discord") return;

      const chatKey = buildChatKey("discord", p.accountId, p.chatId);
      const ids = new Set((p.messageIds ?? []).map((x: any) => String(x)));

      setMessagesByChat((prev) => {
        const list = prev[chatKey];
        if (!list) return prev;

        return {
          ...prev,
          [chatKey]: list.filter((m) => !ids.has(String(m.messageId))),
        };
      });
    };

    /* ---------------- SUBSCRIBE ---------------- */

    socketBus.on("telegram:new_message", handleNewMessage);
    socketBus.on("telegram:message_confirmed", handleConfirmed);
    socketBus.on("telegram:message_edited", handleEdited);
    socketBus.on("telegram:message_deleted", handleDeleted);

    socketBus.on("discord:new_message", handleDiscordNew);
    socketBus.on("discord:message_edited", handleDiscordEdited);
    socketBus.on("discord:message_deleted", handleDiscordDeleted);

    return () => {
      socketBus.off("telegram:new_message", handleNewMessage);
      socketBus.off("telegram:message_confirmed", handleConfirmed);
      socketBus.off("telegram:message_edited", handleEdited);
      socketBus.off("telegram:message_deleted", handleDeleted);

      socketBus.off("discord:new_message", handleDiscordNew);
      socketBus.off("discord:message_edited", handleDiscordEdited);
      socketBus.off("discord:message_deleted", handleDiscordDeleted);
    };
  }, [addOrUpdateMessage, setMessagesByChat]);

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
