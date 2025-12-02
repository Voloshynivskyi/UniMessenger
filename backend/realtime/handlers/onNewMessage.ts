// backend/realtime/handlers/onNewMessage.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { handleTelegramMessageEvent } from "./handleTelegramMessageEvent";
import { telegramPeerToChatId } from "../../utils/telegramPeerToChatId";
import { outgoingTempStore } from "../outgoingTempStore";
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

    // 🔥 OUTGOING CONFIRMATION LOGIC -----------------------------------------
    if (msg.out && resolvedChatId) {
      const pending = outgoingTempStore.shift(accountId, resolvedChatId);

      if (pending) {
        logger.info(
          `[CONFIRMATION] Matched tempId=${pending.tempId} → realId=${msg.id}`
        );

        getSocketGateway().emitToUser(accountId, "telegram:message_confirmed", {
          platform: "telegram",
          accountId,
          timestamp: new Date().toISOString(),
          chatId: resolvedChatId,
          tempId: pending.tempId,
          realMessageId: String(msg.id),
          date: msg.date
            ? new Date(msg.date * 1000).toISOString()
            : new Date().toISOString(),
        });
      }
    }

    // 🔥 continue with normal unified message handling
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
