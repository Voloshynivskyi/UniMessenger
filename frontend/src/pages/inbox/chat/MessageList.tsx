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

export default function MessageList({ chatKey, messages, chat }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { fetchOlderMessages, loadingByChat, fullyLoadedByChat } =
    useMessages();
  const isLoading = !!loadingByChat[chatKey];
  const fullyLoaded = !!fullyLoadedByChat[chatKey];

  const wasAtBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const prevFirstMessageIdRef = useRef<string | number | null>(null);

  // ---------------------------
  //  Scroll handler
  // ---------------------------
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;

    const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 40;
    wasAtBottomRef.current = isAtBottom;

    if (!isLoading && !fullyLoaded && scrollTop < 80) {
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

  // ---------------------------
  //  Initial scroll to bottom
  // ---------------------------
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!initializedRef.current && messages.length > 0) {
      initializedRef.current = true;
      el.scrollTop = el.scrollHeight;
      prevFirstMessageIdRef.current = messages[0].messageId;
    }
  }, [messages]);

  // ---------------------------
  //  Smooth auto-scroll on media expansion
  // ---------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!wasAtBottomRef.current) return;

      // smooth but fast scroll
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth",
      });

      // fallback to ensure bottom alignment
      setTimeout(() => {
        if (wasAtBottomRef.current) {
          el.scrollTop = el.scrollHeight;
        }
      }, 120);
    });

    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, []);

  // ---------------------------
  //  Maintain scroll when older messages prepend
  // ---------------------------
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const newFirstId = messages[0]?.messageId;
    const prevFirstId = prevFirstMessageIdRef.current;

    if (
      prevFirstId !== null &&
      newFirstId !== null &&
      newFirstId !== prevFirstId
    ) {
      const prevHeight = el.scrollHeight;

      requestAnimationFrame(() => {
        const newHeight = el.scrollHeight;
        el.scrollTop += newHeight - prevHeight;
      });
    }

    prevFirstMessageIdRef.current = newFirstId;
  }, [messages]);

  // ---------------------------
  //  Reset on chat switch
  // ---------------------------
  useEffect(() => {
    initializedRef.current = false;
    wasAtBottomRef.current = true;
    prevFirstMessageIdRef.current = null;
  }, [chatKey]);

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
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const prevDate = prevMsg ? new Date(prevMsg.date) : null;

        const needSeparator =
          !prevDate || currentDate.toDateString() !== prevDate.toDateString();

        return (
          <Fragment key={m.messageId}>
            {needSeparator && <MessageDaySeparator date={m.date} />}
            <MessageRow message={m} isSelf={m.isOutgoing} />
          </Fragment>
        );
      })}

      <Box sx={{ height: 8 }} />
    </Box>
  );
}
