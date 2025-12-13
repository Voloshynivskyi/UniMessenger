// frontend/src/pages/inbox/chat/discord/DiscordMessageList.tsx

import {
  useLayoutEffect,
  useRef,
  useEffect,
  useCallback,
  Fragment,
} from "react";
import { Box, CircularProgress } from "@mui/material";
import type { UnifiedDiscordMessage } from "../../../../types/discord.types";
import { useMessages } from "../../../../context/UnifiedMessagesContext";
import DiscordMessageRow from "./DiscordMessageRow";
import MessageDaySeparator from "../MessageDaySeparator";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function isNearBottom(el: HTMLDivElement) {
  const threshold = el.clientHeight * 0.2;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < threshold;
}

/* ---------------------------------------------------------
   Props
--------------------------------------------------------- */

interface Props {
  chatKey: string;
  messages: UnifiedDiscordMessage[];
  accountId: string;
}

/* ---------------------------------------------------------
   MAIN
--------------------------------------------------------- */

export default function DiscordMessageList({
  chatKey,
  messages,
  accountId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { fetchOlderMessages, loadingByChat, fullyLoadedByChat } =
    useMessages();

  const isLoading = !!loadingByChat[chatKey];
  const fullyLoaded = !!fullyLoadedByChat[chatKey];

  const wasAtBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const prevLastMessageIdRef = useRef<string | null>(null);

  // 🧷 Якір для seamless prepend
  const anchorRef = useRef<{
    messageId: string;
    top: number;
  } | null>(null);

  /* ---------------------------------------------------------
     Scroll handler + pagination
  --------------------------------------------------------- */

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    wasAtBottomRef.current = isNearBottom(el);

    if (!isLoading && !fullyLoaded && el.scrollTop <= 60) {
      // Фіксуємо якір
      const firstVisible = el.querySelector("[data-message-id]");
      if (firstVisible) {
        const rect = firstVisible.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();

        anchorRef.current = {
          messageId: (firstVisible as HTMLElement).dataset.messageId!,
          top: rect.top - containerRect.top,
        };
      }
      console.log("[DISCORD PAGINATION TRIGGER]", {
        chatKey,
        oldestMessageId: messages[0]?.messageId,
      });

      fetchOlderMessages({
        chatKey,
        accountId,
      });
    }
  }, [chatKey, fetchOlderMessages, fullyLoaded, isLoading]);

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
      String(messages[messages.length - 1]?.messageId) ?? null;
  }, [messages]);

  /* ---------------------------------------------------------
     Restore scroll after prepend
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
     Auto-scroll on NEW message
  --------------------------------------------------------- */

  useEffect(() => {
    const el = containerRef.current;
    if (!el || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg.messageId;

    if (prevLastMessageIdRef.current === null) {
      prevLastMessageIdRef.current = String(lastId);
      return;
    }

    if (lastId === prevLastMessageIdRef.current) return;

    const shouldScroll =
      lastMsg.isOutgoing || wasAtBottomRef.current || isNearBottom(el);

    if (shouldScroll) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        wasAtBottomRef.current = true;
      });
    }

    prevLastMessageIdRef.current = String(lastId);
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
      }}
    >
      {showTopLoader && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const needSeparator =
          !prev ||
          new Date(prev.date).toDateString() !==
            new Date(m.date).toDateString();

        return (
          <Fragment key={m.messageId}>
            {needSeparator && <MessageDaySeparator date={m.date} />}
            <div data-message-id={String(m.messageId)}>
              <DiscordMessageRow message={m} prevMessage={prev} />
            </div>
          </Fragment>
        );
      })}

      <Box sx={{ height: 12 }} />
    </Box>
  );
}
