// backend/realtime/handlers/onEditedMessage.ts

import { Api } from "telegram";
import { logger } from "../../../utils/logger";
import { handleTelegramMessageEvent } from "../telegram/handleTelegramMessageEvent";
import { telegramPeerToChatId } from "../../../utils/telegram/telegramPeerToChatId";

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

    // Ensure senderId is set for unified pipeline
    if (!msg.fromId && msg.peerId instanceof Api.PeerUser) {
      msg.fromId = msg.peerId; // ensure sender for private chats
    }

    // Resolve chatId (same as in NEW)
    // ----------------------------------------------
    let resolvedChat: any = null;
    let resolvedChatId: string | null = null;
    let resolvedAccessHash: string | null = null;

    try {
      resolvedChat = await msg.getChat();
      if (resolvedChat) {
        resolvedChatId = String(resolvedChat.id);
        resolvedAccessHash = resolvedChat.accessHash ?? null;
      }
    } catch (err) {
      logger.warn("[onEditedMessage] msg.getChat() failed", { err });
    }

    if (!resolvedChatId && msg.peerId) {
      resolvedChatId = telegramPeerToChatId(msg.peerId);
    }

    if (!resolvedChatId) {
      logger.error("[onEditedMessage] Could NOT resolve chatId!");
      return;
    }

    await handleTelegramMessageEvent({
      kind: "EDIT",
      msg,
      accountId,
      userId,
      resolvedChatId,
      resolvedAccessHash,
    });
  } catch (err) {
    logger.error("[onEditedMessage] ERROR:", { err });
  }
}
