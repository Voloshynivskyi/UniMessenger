// File: frontend/src/hooks/useChatSenders.ts
// Owns: composer state (text/sending/uploading), send text, send file, optimistic bubbles.

import React from "react";
import { sendMessage } from "../api/telegramMessages";
import { sendMediaFile } from "../api/telegramMedia";
import { labelForFile } from "../utils/chat";
import type { Msg } from "../types/chat";

const DEDUP_WINDOW = 10_000; // keep consistent with feed

type Args = {
  sessionId: string | null;
  peerKey: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  setError: (s: string | null) => void;
  replaceOptimisticWithReal: (real: Msg) => boolean;
  outboxMapRef: React.RefObject<
    Map<string, Array<{ localId: string; stamp: number }>>
  >;
};

export function useChatSenders({
  sessionId,
  peerKey,
  listRef,
  setMessages,
  setError,
  replaceOptimisticWithReal,
  outboxMapRef,
}: Args) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const appendOptimistic = React.useCallback(
    (msg: Msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 16);
    },
    [listRef, setMessages]
  );

  // ---- Text ----
  const doSend = React.useCallback(
    async (bodyText: string) => {
      if (!sessionId || !peerKey) return;
      const t = bodyText.trim();
      if (!t) return;

      setSending(true);
      const localId = `local-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const now = Date.now();
      const optimistic: Msg = {
        id: localId,
        peerKey,
        text: t,
        date: now,
        out: true,
        service: false,
      };

      const key = `${peerKey}|${t}`;
      const queue = outboxMapRef.current.get(key) || [];
      queue.push({ localId, stamp: now });
      outboxMapRef.current.set(key, queue);

      appendOptimistic(optimistic);

      try {
        const resp = await sendMessage(sessionId, peerKey, t);
        const payload: any =
          resp && typeof resp === "object" && "message" in (resp as any)
            ? (resp as any).message
            : resp;

        const real: Msg = {
          id: Number(payload?.id ?? now),
          peerKey: String(payload?.peerKey || peerKey),
          text: String(payload?.text ?? t),
          date: payload?.date ?? now,
          out: true,
          service: !!payload?.service,
        };

        replaceOptimisticWithReal(real);
      } catch (e: any) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== localId));
        const arr = outboxMapRef.current.get(key) || [];
        outboxMapRef.current.set(
          key,
          arr.filter((x) => x.localId !== localId)
        );
        if ((outboxMapRef.current.get(key) || []).length === 0)
          outboxMapRef.current.delete(key);
        setError(e?.message || "Failed to send message");
      } finally {
        setSending(false);
      }
    },
    [
      sessionId,
      peerKey,
      outboxMapRef,
      appendOptimistic,
      setMessages,
      setError,
      replaceOptimisticWithReal,
    ]
  );

  // ---- File ----
  const onAttachClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f || !sessionId || !peerKey) return;

      const cap = text.trim() ? text.trim() : undefined;
      setUploading(true);

      const localId = `upload-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const now = Date.now();
      const optimisticText = cap ?? labelForFile(f);
      const optimistic: Msg = {
        id: localId,
        peerKey,
        text: optimisticText,
        date: now,
        out: true,
        service: false,
      };

      if (optimisticText.trim()) {
        const key = `${peerKey}|${optimisticText.trim()}`;
        const queue = outboxMapRef.current.get(key) || [];
        queue.push({ localId, stamp: now });
        outboxMapRef.current.set(key, queue);
      }

      appendOptimistic(optimistic);

      try {
        const resp = await sendMediaFile(sessionId, peerKey, f, {
          caption: cap,
        });
        const payload: any =
          resp && typeof resp === "object" && "message" in (resp as any)
            ? (resp as any).message
            : resp;

        const real: Msg = {
          id: Number(payload?.id ?? now),
          peerKey: String(payload?.peerKey || peerKey),
          text: String(payload?.text ?? cap ?? labelForFile(f)),
          date: payload?.date ?? now,
          out: true,
          service: !!payload?.service,
        };

        replaceOptimisticWithReal(real);
        if (cap) setText("");
      } catch (e: any) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== localId));
        const key = `${peerKey}|${(optimisticText || "").trim()}`;
        const arr = outboxMapRef.current.get(key) || [];
        outboxMapRef.current.set(
          key,
          arr.filter((x) => x.localId !== localId)
        );
        if ((outboxMapRef.current.get(key) || []).length === 0)
          outboxMapRef.current.delete(key);
        setError(e?.message || "Failed to send file");
      } finally {
        setUploading(false);
      }
    },
    [
      sessionId,
      peerKey,
      text,
      outboxMapRef,
      appendOptimistic,
      setMessages,
      setError,
      replaceOptimisticWithReal,
    ]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const v = text;
      if (v.trim()) {
        setText("");
        void doSend(v);
      }
    }
  };

  return {
    text,
    setText,
    sending,
    uploading,
    fileInputRef,
    onKeyDown,
    onAttachClick,
    onFileSelected,
    doSend,
  };
}
