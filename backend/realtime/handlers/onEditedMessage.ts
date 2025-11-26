// backend/realtime/handlers/onEditedMessage.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { getSocketGateway } from "../socketGateway";

/**
 * Handles edited message events from Telegram
 *
 * This handler processes message edit events by resolving the chat information,
 * extracting the updated message text, and emitting the edit event to connected clients.
 * It uses the same chat resolution logic as new messages to maintain consistency.
 *
 * @param event - The raw Telegram event object containing the edited message
 * @param accountId - The Telegram account ID where the message was edited
 * @param userId - The UniMessenger user ID who owns the account
 */
export async function onEditedMessage(
  event: any,
  accountId: string,
  userId: string
) {
  try {
    logger.info("=== [onEditedMessage] EDIT EVENT FIRED ===");

    if (!event || !event.message) {
      logger.warn("[onEditedMessage] No message in event");
      return;
    }

    const msg = event.message as Api.Message;
    const socket = getSocketGateway();

    // ----------------------------------------------
    // 1) Message ID + new text
    // ----------------------------------------------
    const messageId = String(msg.id);
    const newText = msg.message ?? "";

    // ----------------------------------------------
    // 2) Resolve chatId
    //    (same resolution pipeline as NEW messages)
    // ----------------------------------------------
    let chatId: string | null = null;

    try {
      const chat = await msg.getChat(); // full PeerChat | PeerChannel | PeerUser
      if (chat) {
        chatId = String(chat.id);
      }
    } catch (err) {
      logger.warn("[onEditedMessage] msg.getChat() failed, fallback", { err });
    }

    // Fallback: PeerUser → private chat
    if (!chatId && msg.peerId instanceof Api.PeerUser) {
      chatId = String(msg.peerId.userId);
    }

    if (!chatId) {
      logger.error("[onEditedMessage] Could NOT resolve chatId!");
      return;
    }

    // ----------------------------------------------
    // 3) Sender (who made the edit)
    // ----------------------------------------------
    const senderId =
      msg.fromId instanceof Api.PeerUser
        ? String(msg.fromId.userId)
        : msg.peerId instanceof Api.PeerUser
        ? String(msg.peerId.userId)
        : "unknown";

    // ----------------------------------------------
    // 4) EDIT Payload
    // ----------------------------------------------

    const payload = {
      platform: "telegram" as const,
      accountId,
      chatId,
      timestamp: new Date().toISOString(),

      messageId,
      newText,

      from: {
        id: senderId,
        name: `User ${senderId}`,
      },
    };

    logger.info(
      `[onEditedMessage] Emitting telegram:message_edited → chatId=${chatId}, msgId=${messageId}`
    );

    socket.emitToUser(userId, "telegram:message_edited", payload);
  } catch (err) {
    logger.error("[onEditedMessage] ERROR:", { err });
  }
}
