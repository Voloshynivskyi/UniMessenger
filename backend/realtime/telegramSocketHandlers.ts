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
  async sendMessage(socket: TypedSocket, data: TelegramSendMessagePayload) {
    try {
      await telegramClientManager.sendMessage(
        data.accountId,
        data.chatId,
        data.text
      );
      logger.info(
        `[Socket] Message sent via TelegramClientManager for account ${data.accountId}`
      );
    } catch (err: any) {
      logger.error(`[Socket] telegram:send_message failed: ${err.message}`);
    }
  },

  async editMessage(socket: TypedSocket, data: TelegramEditMessagePayload) {
    try {
      await telegramClientManager.editMessage(
        data.accountId,
        data.chatId,
        data.messageId,
        data.newText
      );
    } catch (err: any) {
      logger.error(`[Socket] telegram:edit_message failed: ${err.message}`);
    }
  },

  async deleteMessage(socket: TypedSocket, data: TelegramDeleteMessagePayload) {
    try {
      await telegramClientManager.deleteMessages(
        data.accountId,
        data.messageIds
      );
    } catch (err: any) {
      logger.error(`[Socket] telegram:delete_message failed: ${err.message}`);
    }
  },

  async typingStart(socket: TypedSocket, data: TelegramTypingStartPayload) {
    try {
      await telegramClientManager.startTyping(data.accountId, data.chatId);
    } catch (err: any) {
      logger.error(`[Socket] telegram:typing_start failed: ${err.message}`);
    }
  },

  async typingStop(socket: TypedSocket, data: TelegramTypingStopPayload) {
    try {
      await telegramClientManager.stopTyping(data.accountId, data.chatId);
    } catch (err: any) {
      logger.error(`[Socket] telegram:typing_stop failed: ${err.message}`);
    }
  },

  async markAsRead(socket: TypedSocket, data: TelegramMarkAsReadPayload) {
    try {
      await telegramClientManager.markAsRead(
        data.accountId,
        data.chatId,
        data.lastReadMessageId
      );
    } catch (err: any) {
      logger.error(`[Socket] telegram:mark_as_read failed: ${err.message}`);
    }
  },
};
