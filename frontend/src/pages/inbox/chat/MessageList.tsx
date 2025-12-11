// frontend/src/pages/inbox/chat/MessageList.tsx

import {
  useLayoutEffect,
  useRef,
  useEffect,
  useCallback,
  Fragment,
} from "react";
import { Box, CircularProgress } from "@mui/material";
import MessageRow from "./MessageRow";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";
import { useMessages } from "../../../context/UnifiedMessagesContext";
import MessageDaySeparator from "./MessageDaySeparator";

interface Props {
  chatKey: string;
  messages: UnifiedTelegramMessage[];
  chat: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    chatId: string | number | bigint;
    accessHash?: string | number | bigint | null;
  };
}

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function isNearBottom(el: HTMLDivElement) {
  const threshold = el.clientHeight * 0.2;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < threshold;
}

/* ---------------------------------------------------------
   MAIN
--------------------------------------------------------- */

export default function MessageList({ chatKey, messages, chat }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { fetchOlderMessages, loadingByChat, fullyLoadedByChat } =
    useMessages();

  const isLoading = !!loadingByChat[chatKey];
  const fullyLoaded = !!fullyLoadedByChat[chatKey];

  const wasAtBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const prevLastMessageIdRef = useRef<string | number | bigint | null>(null);

  // ✅ ЯКІР ДЛЯ БЕЗШОВНОГО PREPEND
  const anchorRef = useRef<{
    messageId: string | number | bigint;
    top: number;
  } | null>(null);

  /* ---------------------------------------------------------
     Scroll handler + seamless prepend trigger
  --------------------------------------------------------- */

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    wasAtBottomRef.current = isNearBottom(el);

    if (!isLoading && !fullyLoaded && el.scrollTop <= 60) {
      // ✅ ФІКСУЄМО ВІЗУАЛЬНИЙ ЯКІР
      const firstVisible = el.querySelector("[data-message-id]");
      if (firstVisible) {
        const rect = firstVisible.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();

        anchorRef.current = {
          messageId: (firstVisible as HTMLElement).dataset.messageId!,
          top: rect.top - containerRect.top,
        };
      }

      fetchOlderMessages({
        chatKey,
        accountId: chat.accountId,
        peerType: chat.peerType,
        peerId: chat.chatId,
        accessHash: chat.accessHash,
      });
    }
  }, [
    chat.accountId,
    chat.chatId,
    chat.peerType,
    chat.accessHash,
    chatKey,
    fetchOlderMessages,
    fullyLoaded,
    isLoading,
  ]);

  /* ---------------------------------------------------------
     Initial scroll to bottom
  --------------------------------------------------------- */

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current || messages.length === 0) return;

    initializedRef.current = true;
    el.scrollTop = el.scrollHeight;
    wasAtBottomRef.current = true;

    prevLastMessageIdRef.current =
      messages[messages.length - 1]?.messageId ?? null;
  }, [messages]);

  /* ---------------------------------------------------------
     ✅ SEAMLESS SCROLL RESTORE AFTER PREPEND
  --------------------------------------------------------- */

  useLayoutEffect(() => {
    const el = containerRef.current;
    const anchor = anchorRef.current;

    if (!el || !anchor) return;

    const anchorEl = el.querySelector(
      `[data-message-id="${anchor.messageId}"]`
    ) as HTMLElement | null;

    if (!anchorEl) {
      anchorRef.current = null;
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const containerRect = el.getBoundingClientRect();

    const newTop = rect.top - containerRect.top;
    const diff = newTop - anchor.top;

    el.scrollTop += diff;

    anchorRef.current = null;
  }, [messages]);

  /* ---------------------------------------------------------
     Auto-scroll on NEW message only
  --------------------------------------------------------- */

  useEffect(() => {
    const el = containerRef.current;
    if (!el || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg?.messageId ?? null;

    if (prevLastMessageIdRef.current === null) {
      prevLastMessageIdRef.current = lastId;
      return;
    }

    if (lastId === prevLastMessageIdRef.current) return;

    const isSelf = lastMsg?.isOutgoing;
    const shouldScroll = isSelf || wasAtBottomRef.current || isNearBottom(el);

    if (shouldScroll) {
      requestAnimationFrame(() => {
        const inner = containerRef.current;
        if (!inner) return;

        inner.scrollTop = inner.scrollHeight;
        wasAtBottomRef.current = true;
      });
    }

    prevLastMessageIdRef.current = lastId;
  }, [messages]);

  /* ---------------------------------------------------------
     Reset on chat switch
  --------------------------------------------------------- */

  useEffect(() => {
    initializedRef.current = false;
    wasAtBottomRef.current = true;
    prevLastMessageIdRef.current = null;
    anchorRef.current = null;
  }, [chatKey]);

  /* ---------------------------------------------------------
     Render
  --------------------------------------------------------- */

  const showTopLoader = isLoading && !fullyLoaded;

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        px: 2,
        py: 2,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {showTopLoader && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {messages.map((m, index) => {
        const currentDate = new Date(m.date);
        const prevMsg: UnifiedTelegramMessage | null =
          index > 0 ? messages[index - 1] : null;
        const prevDate = prevMsg ? new Date(prevMsg.date) : null;

        const needSeparator =
          !prevDate || currentDate.toDateString() !== prevDate.toDateString();

        return (
          <Fragment key={m.messageId}>
            {needSeparator && <MessageDaySeparator date={m.date} />}

            {/* ✅ КРИТИЧНО: messageId у DOM */}
            <div data-message-id={String(m.messageId)}>
              <MessageRow
                message={m}
                isSelf={m.isOutgoing}
                prevMessage={prevMsg}
                peerType={chat.peerType}
              />
            </div>
          </Fragment>
        );
      })}

      <Box sx={{ height: 12 }} />
    </Box>
  );
}
