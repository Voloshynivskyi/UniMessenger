// backend/realtime/handlers/onNewMessage.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { handleTelegramMessageEvent } from "./handleTelegramMessageEvent";
import { telegramPeerToChatId } from "../../utils/telegramPeerToChatId";

/**
 * Handles incoming new message events from Telegram
 *
 * This handler processes new messages received from Telegram by resolving the full chat information
 * (including access hash for channels) and delegating to the unified message event handler.
 * It implements fallback logic to handle both channel messages and private/group chats.
 *
 * @param event - The raw Telegram event object containing the new message
 * @param accountId - The Telegram account ID that received this message
 * @param userId - The UniMessenger user ID who owns the account
 */
export async function onNewMessage(
  event: any,
  accountId: string,
  userId: string
) {
  try {
    logger.info("=== [onNewMessage] EVENT FIRED ===");
    logger.info(`accountId=${accountId}, userId=${userId}`);

    if (!event || !event.message) {
      logger.warn("[onNewMessage] No event.message");
      return;
    }

    const msg = event.message as Api.Message;

    logger.info(`[onNewMessage] msg.className = ${msg.className}`);
    logger.info(`[onNewMessage] msg.id = ${msg.id}`);
    logger.info(`[onNewMessage] msg.date = ${msg.date}`);
    logger.info(`[onNewMessage] msg.out = ${msg.out}`);
    logger.info("[onNewMessage] msg keys:", Object.keys(msg));

    // ----------------------------------------------------------
    // Resolve full chat for channels to avoid "unknown" chatId
    // ----------------------------------------------------------
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
      logger.warn(
        "[onNewMessage] Failed to resolve chat via msg.getChat(), fallback to peerId...",
        { err }
      );
    }

    // Fallback to peer-based chatId for private/group dialogs
    if (!resolvedChatId && msg.peerId) {
      resolvedChatId = telegramPeerToChatId(msg.peerId);
    }

    logger.info(
      `[onNewMessage] Resolved chatId = ${
        resolvedChatId ?? "null"
      } | accessHash = ${resolvedAccessHash ?? "null"}`
    );

    await handleTelegramMessageEvent({
      kind: "NEW",
      msg,
      accountId,
      userId,
      resolvedChatId,
      resolvedAccessHash,
    });
  } catch (err) {
    logger.error("[onNewMessage] ERROR:", { err });
  }
}
