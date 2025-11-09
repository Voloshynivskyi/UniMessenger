// frontend/src/hooks/useTelegramSocket.ts
import { useEffect } from "react";
import { socketClient } from "../socketClient";
import { useRealtime } from "../../context/RealtimeContext";
import type {
  TelegramNewMessagePayload,
  TelegramTypingPayload,
  TelegramMessageEditedPayload,
  TelegramMessageDeletedPayload,
  TelegramAccountStatusPayload,
  TelegramReadUpdatesPayload,
} from "../events";

/**
 * Custom hook to manage Telegram WebSocket events
 */
export function useTelegramSocket() {
  const { connected } = useRealtime();
  useEffect(() => {
    console.log("[useTelegramSocket] Effect triggered, connected:", connected);
    if (!connected) return;

    socketClient.on(
      "telegram:new_message",
      (data: TelegramNewMessagePayload) => {
        console.log("[Telegram] New message:", data);
      }
    );

    socketClient.on("telegram:typing", (data: TelegramTypingPayload) => {
      console.log("[Telegram] Typing:", data);
    });

    socketClient.on(
      "telegram:message_edited",
      (data: TelegramMessageEditedPayload) => {
        console.log("[Telegram] Message edited:", data);
      }
    );

    socketClient.on(
      "telegram:message_deleted",
      (data: TelegramMessageDeletedPayload) => {
        console.log("[Telegram] Message deleted:", data);
      }
    );

    socketClient.on(
      "telegram:account_status",
      (data: TelegramAccountStatusPayload) => {
        console.log("[Telegram] Account status:", data);
      }
    );

    socketClient.on(
      "telegram:read_updates",
      (data: TelegramReadUpdatesPayload) => {
        console.log("[Telegram] Read updates:", data);
      }
    );

    return () => {
      socketClient.off("telegram:new_message");
      socketClient.off("telegram:typing");
      socketClient.off("telegram:message_edited");
      socketClient.off("telegram:message_deleted");
      socketClient.off("telegram:account_status");
      socketClient.off("telegram:read_updates");
    };
  }, [connected]);
}
