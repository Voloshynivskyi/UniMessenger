// frontend/src/realtime/telegramSocket.ts
import { socketClient } from "./socketClient";
import type {
  TelegramSendMessagePayload,
  TelegramTypingStartPayload,
  TelegramTypingStopPayload,
  TelegramMarkAsReadPayload,
  TelegramEditMessagePayload,
  TelegramDeleteMessagePayload,
  TelegramNewMessagePayload,
  TelegramTypingPayload,
  TelegramMessageEditedPayload,
  TelegramMessageDeletedPayload,
  TelegramReadUpdatesPayload,
  TelegramAccountStatusPayload,
  TelegramPinnedMessagesPayload,
  TelegramMessageViewPayload,
} from "./events";

// Telegram Socket API

export const telegramSocket = {
  // ======================
  // EMIT (Client → Server)
  // ======================

  sendMessage(data: TelegramSendMessagePayload) {
    socketClient.emit("telegram:send_message", data);
  },

  editMessage(data: TelegramEditMessagePayload) {
    socketClient.emit("telegram:edit_message", data);
  },

  deleteMessage(data: TelegramDeleteMessagePayload) {
    socketClient.emit("telegram:delete_message", data);
  },

  typingStart(data: TelegramTypingStartPayload) {
    socketClient.emit("telegram:typing_start", data);
  },

  typingStop(data: TelegramTypingStopPayload) {
    socketClient.emit("telegram:typing_stop", data);
  },

  markAsRead(data: TelegramMarkAsReadPayload) {
    socketClient.emit("telegram:mark_as_read", data);
  },

  // ======================
  // ON (Server → Client)
  // ======================

  onNewMessage(callback: (data: TelegramNewMessagePayload) => void) {
    socketClient.on("telegram:new_message", callback);
  },

  onTyping(callback: (data: TelegramTypingPayload) => void) {
    socketClient.on("telegram:typing", callback);
  },

  onMessageEdited(callback: (data: TelegramMessageEditedPayload) => void) {
    socketClient.on("telegram:message_edited", callback);
  },

  onMessageDeleted(callback: (data: TelegramMessageDeletedPayload) => void) {
    socketClient.on("telegram:message_deleted", callback);
  },

  onReadUpdates(callback: (data: TelegramReadUpdatesPayload) => void) {
    socketClient.on("telegram:read_updates", callback);
  },

  onAccountStatus(callback: (data: TelegramAccountStatusPayload) => void) {
    socketClient.on("telegram:account_status", callback);
  },
  onMessageViews(callback: (data: TelegramMessageViewPayload) => void) {
    socketClient.on("telegram:message_views", callback);
  },
  onPinnedMessages(callback: (data: TelegramPinnedMessagesPayload) => void) {
    socketClient.on("telegram:pinned_messages", callback);
  },
  // ======================
  // OFF (Unsubscribe)
  // ======================

  offNewMessage(callback: (data: TelegramNewMessagePayload) => void) {
    socketClient.off("telegram:new_message", callback);
  },

  offTyping(callback: (data: TelegramTypingPayload) => void) {
    socketClient.off("telegram:typing", callback);
  },

  offMessageEdited(callback: (data: TelegramMessageEditedPayload) => void) {
    socketClient.off("telegram:message_edited", callback);
  },

  offMessageDeleted(callback: (data: TelegramMessageDeletedPayload) => void) {
    socketClient.off("telegram:message_deleted", callback);
  },

  offReadUpdates(callback: (data: TelegramReadUpdatesPayload) => void) {
    socketClient.off("telegram:read_updates", callback);
  },

  offAccountStatus(callback: (data: TelegramAccountStatusPayload) => void) {
    socketClient.off("telegram:account_status", callback);
  },
  offMessageViews(callback: (data: TelegramMessageViewPayload) => void) {
    socketClient.off("telegram:message_views", callback);
  },
  offPinnedMessages(callback: (data: TelegramPinnedMessagesPayload) => void) {
    socketClient.off("telegram:pinned_messages", callback);
  },
};
