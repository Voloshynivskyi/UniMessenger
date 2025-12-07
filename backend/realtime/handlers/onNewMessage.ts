// backend/realtime/handlers/onNewMessage.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { handleTelegramMessageEvent } from "./handleTelegramMessageEvent";
import { telegramPeerToChatId } from "../../utils/telegram/telegramPeerToChatId";
import { getSocketGateway } from "../socketGateway";

export async function onNewMessage(
  event: any,
  accountId: string,
  userId: string
) {
  try {
    logger.info("=== [onNewMessage] EVENT FIRED ===");

    if (!event || !event.message) {
      logger.warn("[onNewMessage] No event.message");
      return;
    }

    const msg = event.message as Api.Message;

    // Ensure fromId exists on private chats
    if (!msg.fromId && msg.peerId instanceof Api.PeerUser) {
      msg.fromId = msg.peerId;
    }

    // Resolve chat
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
      logger.warn("[onNewMessage] Failed to resolve chat", { err });
    }

    if (!resolvedChatId && msg.peerId) {
      resolvedChatId = telegramPeerToChatId(msg.peerId);
    }

    // Continue with normal unified message handling
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
