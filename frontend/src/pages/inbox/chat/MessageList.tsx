// frontend/src/pages/inbox/chat/MessageList.tsx
import { useLayoutEffect, useRef, useCallback, useEffect } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useMessages } from "../../../context/UnifiedMessagesContext";
import MessageRow from "./MessageRow";
import type { UnifiedTelegramMessage } from "../../../types/telegram.types";

interface MessageListProps {
  chatKey: string;
  messages: UnifiedTelegramMessage[];
  chat: {
    accountId: string;
    peerType: "user" | "chat" | "channel";
    chatId: string | number | bigint;
    accessHash?: string | number | bigint | null;
  };
}

const TOP_THRESHOLD_PX = 80;
const BOTTOM_THRESHOLD_PX = 120;

export default function MessageList({
  chatKey,
  messages,
  chat,
}: MessageListProps) {
  const { fetchOlderMessages, loadingByChat, fullyLoadedByChat } =
    useMessages();

  const containerRef = useRef<HTMLDivElement | null>(null);

  // scroll management refs
  const initializedRef = useRef(false);
  const prevHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const prevLenRef = useRef(0);
  const prevFirstIdRef = useRef<string | number | null>(null);
  const wasAtBottomRef = useRef(true);

  const isLoading = !!loadingByChat[chatKey];
  const fullyLoaded = !!fullyLoadedByChat[chatKey];
  const hasMessages = messages.length > 0;

  // Reset scroll logic on chat switch
  useEffect(() => {
    initializedRef.current = false;
    prevHeightRef.current = 0;
    prevScrollTopRef.current = 0;
    prevLenRef.current = messages.length;
    prevFirstIdRef.current = messages[0]?.messageId ?? null;
    wasAtBottomRef.current = true;
  }, [chatKey]);

  // Handle scroll → loading older messages
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;

    prevScrollTopRef.current = scrollTop;
    prevHeightRef.current = scrollHeight;

    const distToBottom = scrollHeight - (scrollTop + clientHeight);
    wasAtBottomRef.current = distToBottom < BOTTOM_THRESHOLD_PX;

    if (isLoading || fullyLoaded) return;

    // Load older messages
    if (scrollTop < TOP_THRESHOLD_PX) {
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

  // Maintain scroll position when new messages added
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prevHeight = prevHeightRef.current;
    const prevScrollTop = prevScrollTopRef.current;
    const prevLen = prevLenRef.current;
    const prevFirstId = prevFirstIdRef.current;

    // Initial mount → scroll to bottom
    if (!initializedRef.current) {
      el.scrollTop = el.scrollHeight;
      initializedRef.current = true;

      prevHeightRef.current = el.scrollHeight;
      prevScrollTopRef.current = el.scrollTop;
      prevLenRef.current = messages.length;
      prevFirstIdRef.current = messages[0]?.messageId ?? null;
      return;
    }

    const newLen = messages.length;
    const newFirstId = messages[0]?.messageId;

    // Older messages loaded at the top
    const appendedOlder =
      prevLen > 0 &&
      newLen > prevLen &&
      newFirstId !== undefined &&
      newFirstId !== null &&
      newFirstId !== prevFirstId;

    if (appendedOlder) {
      const newHeight = el.scrollHeight;
      const diff = newHeight - prevHeight;
      el.scrollTop = prevScrollTop + diff;
    } else if (wasAtBottomRef.current) {
      // Stay pinned to bottom
      el.scrollTop = el.scrollHeight;
    }

    prevHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
    prevLenRef.current = messages.length;
    prevFirstIdRef.current = messages[0]?.messageId ?? null;
  }, [messages]);

  const showTopLoader = hasMessages && isLoading && !fullyLoaded;

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        px: 2,
        py: 2,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      {/* Loader for old messages */}
      {showTopLoader && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* Empty chat message */}
      {!isLoading && messages.length === 0 && (
        <Box sx={{ mt: 4, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No messages yet</Typography>
        </Box>
      )}

      {/* Render messages */}
      {messages.map((m) => (
        <MessageRow key={m.messageId} message={m} isSelf={!!m.isOutgoing} />
      ))}

      <Box sx={{ height: 8 }} />
    </Box>
  );
}
