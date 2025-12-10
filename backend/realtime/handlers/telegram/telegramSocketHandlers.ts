// backend/realtime/telegramSocketHandlers.ts
import { Socket } from "socket.io";
import telegramClientManager from "../../../services/telegram/telegramClientManager";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TelegramTypingStartPayload,
  TelegramTypingStopPayload,
  TelegramMarkAsReadPayload,
} from "../../events";
import { logger } from "../../../utils/logger";
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export const telegramSocketHandlers = {
  // Typing start event
  async typingStart(socket: TypedSocket, data: TelegramTypingStartPayload) {
    try {
      await telegramClientManager.startTyping(
        data.accountId,
        data.chatId,
        data.peerType ?? "chat",
        data.accessHash
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:typing_start failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // Typing stop event
  async typingStop(socket: TypedSocket, data: TelegramTypingStopPayload) {
    try {
      await telegramClientManager.stopTyping(
        data.accountId,
        data.chatId,
        data.peerType ?? "chat",
        data.accessHash
      );
    } catch (err: any) {
      logger.error(
        `[Socket] telegram:typing_stop failed for ${data.accountId}: ${err.message}`
      );
    }
  },

  // Mark messages as read
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
