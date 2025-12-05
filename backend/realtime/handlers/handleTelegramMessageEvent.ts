// backend/realtime/handlers/handleTelegramMessageEvent.ts

import { Api } from "telegram";
import { logger } from "../../utils/logger";
import { getSocketGateway } from "../../realtime/socketGateway";
import { TelegramMessageIndexService } from "../../services/telegram/telegramMessageIndexService";

import { extractMediaFromMessage } from "../../utils/telegramMedia";

import type { UnifiedTelegramMessage } from "../../types/telegram.types";
import telegramClientManager from "../../services/telegram/telegramClientManager";

/**
 * Handle NEW or EDIT Telegram Message and emit unified payload to frontend.
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

    // ----------------------------------------------
    // 1) Chat ID
    // ----------------------------------------------
    const chatId = resolvedChatId ?? "unknown";

    // ----------------------------------------------
    // 2) Sender resolve + fetch real entity (user/chat/channel)
    // ----------------------------------------------
    let senderId: string | null = null;

    if (msg.fromId instanceof Api.PeerUser) {
      senderId = String(msg.fromId.userId);
    } else if (msg.peerId instanceof Api.PeerUser) {
      senderId = String(msg.peerId.userId);
    }

    // витягуємо ентиті відправника з кешу TelegramClientManager
    const senderEntity = telegramClientManager.resolveSenderEntity(
      accountId,
      msg.fromId ?? msg.peerId
    );

    // Формуємо людське імʼя
    function getDisplayName(entity: any): string {
      if (!entity) return "Unknown";

      if (entity instanceof Api.User) {
        const full = `${entity.firstName ?? ""} ${
          entity.lastName ?? ""
        }`.trim();
        return full || entity.username || "Unknown";
      }

      if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
        return entity.title ?? "Unknown";
      }

      return "Unknown";
    }

    const from = {
      id: senderId ?? "0",
      name: getDisplayName(senderEntity),
      username:
        senderEntity instanceof Api.User ? senderEntity.username ?? null : null,
    };

    // ----------------------------------------------
    // 3) Text (caption or message)
    // ----------------------------------------------
    const text = msg.message ?? "";

    // ----------------------------------------------
    // 4) Date
    // ----------------------------------------------
    const dateIso = new Date(msg.date * 1000).toISOString();

    // ----------------------------------------------
    // 5) Unified media
    // ----------------------------------------------
    const mediaInfo = extractMediaFromMessage(msg);

    // Ensure voice waveform and duration are forwarded
    if (mediaInfo.type === "voice" && mediaInfo.media) {
      // Витягнути waveform з сирих атрибутів документа
      const doc = (msg.media as any)?.document;
      if (doc?.attributes) {
        for (const attr of doc.attributes) {
          if (attr instanceof Api.DocumentAttributeAudio) {
            if (attr.waveform)
              mediaInfo.media.waveform = Array.from(attr.waveform);
            if (attr.duration) mediaInfo.media.duration = attr.duration;
          }
        }
      }

      // Якщо Telegram дав пустий waveform → поставити placeholder
      if (!mediaInfo.media.waveform) {
        mediaInfo.media.waveform = [];
      }
    }

    // ----------------------------------------------
    // 6) Peer type detection
    // ----------------------------------------------
    let peerType: "user" | "chat" | "channel" | null = null;

    if (msg.peerId instanceof Api.PeerUser) {
      peerType = "user";
    } else if (msg.peerId instanceof Api.PeerChat) {
      peerType = "chat";
    } else if (msg.peerId instanceof Api.PeerChannel) {
      peerType = "channel";
    }

    // ----------------------------------------------
    // 7) Build UnifiedTelegramMessage
    // ----------------------------------------------
    const unifiedMessage: UnifiedTelegramMessage = {
      platform: "telegram",

      accountId,
      chatId,

      messageId: String(msg.id),
      date: dateIso,
      isOutgoing: msg.out ?? false,
      status: "sent",

      text,
      from,

      senderId,

      // Add peerType only if available
      ...(peerType !== null ? { peerType } : {}),

      peerId: chatId,
      accessHash: resolvedAccessHash ?? null,

      type: mediaInfo.type,
      media: mediaInfo.media,
    };

    // ----------------------------------------------
    // 8) Index NEW messages
    // ----------------------------------------------
    if (kind === "NEW") {
      const peerMeta: {
        rawPeerType?: string;
        rawPeerId?: string;
        rawAccessHash?: string | null;
      } = {
        rawPeerId: chatId,
        rawAccessHash: resolvedAccessHash ?? null,
      };

      if (peerType !== null) {
        peerMeta.rawPeerType = peerType;
      }

      await TelegramMessageIndexService.addIndex(
        accountId,
        unifiedMessage.messageId,
        chatId,
        new Date(msg.date * 1000),
        peerMeta
      );
    }

    // ----------------------------------------------
    // 9) Base payload meta
    // ----------------------------------------------
    const baseMeta = {
      platform: "telegram" as const,
      accountId,
      timestamp: new Date().toISOString(),
    };

    // ----------------------------------------------
    // 10) Emit NEW message
    // ----------------------------------------------
    if (kind === "NEW") {
      const payload = {
        ...baseMeta,
        chatId,
        message: unifiedMessage,
      };

      logger.info(
        `[handleTelegramMessageEvent] Emitting telegram:new_message → chatId=${chatId}, msgId=${msg.id}`
      );

      socket.emitToUser(userId, "telegram:new_message", payload);
    }
    // ----------------------------------------------
    // 11) Emit EDIT message
    // ----------------------------------------------
    else {
      const payload = {
        ...baseMeta,
        chatId,
        messageId: unifiedMessage.messageId,
        newText: unifiedMessage.text ?? "",
        from: unifiedMessage.from,
        updated: unifiedMessage,
      };

      logger.info(
        `[handleTelegramMessageEvent] Emitting telegram:message_edited → chatId=${chatId}, msgId=${msg.id}`
      );

      socket.emitToUser(userId, "telegram:message_edited", payload);
    }

    logger.info("[handleTelegramMessageEvent] DONE");
  } catch (err) {
    logger.error("[handleTelegramMessageEvent] ERROR:", { err });
  }
}
