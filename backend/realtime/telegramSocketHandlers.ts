// backend/realtime/telegramSocketHandlers.ts
import { Socket } from "socket.io";
import telegramClientManager from "../services/telegram/telegramClientManager";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TelegramSendMessagePayload,
  TelegramEditMessagePayload,
  TelegramDeleteMessagePayload,
  TelegramTypingStartPayload,
  TelegramTypingStopPayload,
  TelegramMarkAsReadPayload,
} from "./events";
import { logger } from "../utils/logger";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export const telegramSocketHandlers = {
  // ────────────────────────────────────────────────
  // SEND MESSAGE
  // ────────────────────────────────────────────────
  async sendMessage(socket: TypedSocket, data: TelegramSendMessagePayload) {
    try {
      await telegramClientManager.sendMessage(
        data.accountId,
        data.chatId,
        data.text,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.info(
        `[Socket] Message sent for account ${data.accountId}, chat ${data.chatId}`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:send_message failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // ────────────────────────────────────────────────
  // EDIT MESSAGE
  // ────────────────────────────────────────────────
  async editMessage(socket: TypedSocket, data: TelegramEditMessagePayload) {
    try {
      await telegramClientManager.editMessage(
        data.accountId,
        data.chatId,
        data.messageId,
        data.newText,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.info(
        `[Socket] Edited message ${data.messageId} for account ${data.accountId}`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:edit_message failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // ────────────────────────────────────────────────
  // DELETE MESSAGE(S)
  // ────────────────────────────────────────────────
  async deleteMessage(socket: TypedSocket, data: TelegramDeleteMessagePayload) {
    try {
      await telegramClientManager.deleteMessages(
        data.accountId,
        data.chatId,
        data.messageIds,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.info(
        `[Socket] Deleted messages [${data.messageIds.join(
          ", "
        )}] for account ${data.accountId}`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:delete_message failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // ────────────────────────────────────────────────
  // TYPING START
  // ────────────────────────────────────────────────
  async typingStart(socket: TypedSocket, data: TelegramTypingStartPayload) {
    try {
      await telegramClientManager.startTyping(
        data.accountId,
        data.chatId,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.debug(
        `[Socket] Typing start for ${data.accountId} → chat ${data.chatId}`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:typing_start failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // ────────────────────────────────────────────────
  // TYPING STOP
  // ────────────────────────────────────────────────
  async typingStop(socket: TypedSocket, data: TelegramTypingStopPayload) {
    try {
      await telegramClientManager.stopTyping(
        data.accountId,
        data.chatId,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.debug(
        `[Socket] Typing stop for ${data.accountId} → chat ${data.chatId}`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:typing_stop failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // ────────────────────────────────────────────────
  // MARK AS READ
  // ────────────────────────────────────────────────
  async markAsRead(socket: TypedSocket, data: TelegramMarkAsReadPayload) {
    try {
      await telegramClientManager.markAsRead(
        data.accountId,
        data.chatId,
        data.lastReadMessageId,
        data.peerType ?? "chat",
        data.accessHash
      );

      logger.info(
        `[Socket] Marked messages as read in chat ${data.chatId} (account ${data.accountId})`
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:mark_as_read failed for ${data.accountId}: ${err.message}`
      );
    }
  },
};
