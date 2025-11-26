// backend/realtime/handlers/handleTelegramMessageEvent.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { getSocketGateway } from "../../realtime/socketGateway";
import { TelegramMessageIndexService } from "../../services/telegram/telegramMessageIndexService";

/**
 * Handles Telegram message events (new or edited messages)
 *
 * This function processes incoming Telegram messages and emits them to connected clients via WebSocket.
 * It resolves the chat ID, extracts sender information, indexes new messages in the database,
 * and constructs the appropriate payload for real-time delivery.
 *
 * @param kind - Type of message event: "NEW" for new messages, "EDIT" for edited messages
 * @param msg - Telegram API Message object containing the message data
 * @param accountId - The Telegram account ID that received this message
 * @param userId - The UniMessenger user ID who owns the account
 * @param resolvedChatId - Pre-resolved chat ID from the message peer
 * @param resolvedAccessHash - Pre-resolved access hash for the chat (used for API calls)
 */
export async function handleTelegramMessageEvent({
  kind,
  msg,
  accountId,
  userId,
  resolvedChatId,
  resolvedAccessHash,
}: {
  kind: "NEW" | "EDIT";
  msg: Api.Message;
  accountId: string;
  userId: string;
  resolvedChatId?: string | null;
  resolvedAccessHash?: string | null;
}) {
  try {
    logger.info("=== [handleTelegramMessageEvent] FIRED ===");
    if (!msg) return;

    const socket = getSocketGateway();

    // ------------------------------------------------------
    // 1) Extract chatId ONLY from resolvedChatId
    // ------------------------------------------------------
    const chatId = resolvedChatId ?? "unknown";

    // ------------------------------------------------------
    // 2) sender
    // ------------------------------------------------------
    let senderUserId: string | null = null;

    if (msg.fromId instanceof Api.PeerUser) {
      senderUserId = String(msg.fromId.userId);
    } else if (msg.peerId instanceof Api.PeerUser) {
      senderUserId = String(msg.peerId.userId);
    }

    // ------------------------------------------------------
    // 3) text
    // ------------------------------------------------------
    const text = msg.message ?? "";

    // ------------------------------------------------------
    // 4) date
    // ------------------------------------------------------
    const dateIso = new Date(msg.date * 1000).toISOString();

    // ------------------------------------------------------
    // 5) "from" object
    // ------------------------------------------------------
    const from = {
      id: senderUserId ?? "0",
      name: `User ${senderUserId ?? "unknown"}`,
    };

    // ------------------------------------------------------
    // 6) Index (NEW only)
    // ------------------------------------------------------
    if (kind === "NEW") {
      await TelegramMessageIndexService.addIndex(
        accountId,
        String(msg.id),
        chatId,
        new Date(msg.date * 1000),
        {
          rawPeerType: "dialog",
          rawPeerId: chatId,
          rawAccessHash: resolvedAccessHash ?? null,
        }
      );
    }

    // ------------------------------------------------------
    // 7) Payload
    // ------------------------------------------------------
    const payload = {
      platform: "telegram" as const,
      accountId,
      timestamp: new Date().toISOString(),
      chatId,
      message: {
        id: String(msg.id),
        text,
        date: dateIso,
        from,
        isOutgoing: msg.out ?? false,
      },
    };

    // ------------------------------------------------------
    // 8) Emit
    // ------------------------------------------------------
    if (kind === "NEW") {
      logger.info(
        `[handleTelegramMessageEvent] Emitting telegram:new_message → chatId=${chatId}, msgId=${msg.id}`
      );
      socket.emitToUser(userId, "telegram:new_message", payload);
    } else {
      logger.info(
        `[handleTelegramMessageEvent] Emitting telegram:message_edited → chatId=${chatId}, msgId=${msg.id}`
      );
      socket.emitToUser(userId, "telegram:message_edited", {
        ...payload,
        messageId: String(msg.id),
        newText: text,
      });
    }

    logger.info("[handleTelegramMessageEvent] DONE");
  } catch (err) {
    logger.error("[handleTelegramMessageEvent] ERROR:", { err });
  }
}
