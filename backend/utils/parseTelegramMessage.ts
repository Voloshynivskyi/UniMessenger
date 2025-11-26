// backend/utils/parseTelegramMessage.ts

import { Api } from "telegram";
import type { UnifiedTelegramMessage } from "../types/telegram.types";

/**
 * Main unified message parser for Telegram MTProto messages
 *
 * This function converts raw Telegram API message objects into a unified message format
 * that can be consistently handled throughout the application. It handles different
 * message types including normal messages, service messages, and empty messages.
 *
 * @param msg - Raw Telegram API message object (TypeMessage)
 * @param accountId - The Telegram account ID that owns this message
 * @returns Unified Telegram message object with standardized structure
 */
export function parseTelegramMessage(
  msg: Api.TypeMessage,
  accountId: string
): UnifiedTelegramMessage {
  if (msg instanceof Api.MessageEmpty) {
    return makeUnknown(accountId, msg.id);
  }

  if (msg instanceof Api.MessageService) {
    return parseService(msg, accountId);
  }

  if (msg instanceof Api.Message) {
    return parseNormal(msg, accountId);
  }

  return makeUnknown(accountId, Date.now());
}

/* ========================================================================
   NORMAL MESSAGE
   ======================================================================== */

/**
 * Parses a normal Telegram message (text, media, etc.)
 *
 * Extracts all relevant information from a standard message including:
 * - Peer and sender information
 * - Message content (text, media)
 * - Timestamps and delivery status
 * - Media handling (photos, documents, etc.)
 *
 * @param msg - Telegram API Message object
 * @param accountId - The Telegram account ID
 * @returns Unified message object with full message details
 */
function parseNormal(
  msg: Api.Message,
  accountId: string
): UnifiedTelegramMessage {
  const { peerType, peerId, accessHash } = extractPeer(msg.peerId);
  const senderId = extractSenderId(msg.fromId);

  const base: UnifiedTelegramMessage = {
    platform: "telegram",
    accountId,

    messageId: String(msg.id),
    chatId: peerId,

    peerType,
    peerId,
    accessHash: accessHash ?? null,

    senderId,

    date: new Date(msg.date * 1000).toISOString(),
    isOutgoing: msg.out ?? false,

    status: "sent",

    from: {
      id: senderId ?? "0",
      name: senderId ? "User" : "Unknown",
    },

    type: "text",
    text: msg.message || "",
  };

  // no media
  if (!msg.media) return base;

  // photo
  if (
    msg.media instanceof Api.MessageMediaPhoto &&
    msg.media.photo instanceof Api.Photo
  ) {
    const photo = msg.media.photo;
    const best = selectBestPhotoSize(photo.sizes);

    return {
      ...base,
      type: "photo",
      media: {
        id: String(photo.id),
        accessHash: String(photo.accessHash),
        dcId: photo.dcId,
        width: best.w,
        height: best.h,
        size: best.size,
      },
    };
  }

  // unknown media
  return {
    ...base,
    type: "unknown",
  };
}

/* ========================================================================
   SERVICE MESSAGE
   ======================================================================== */

/**
 * Parses a Telegram service message
 *
 * Service messages represent system events in chats such as:
 * - User joined/left
 * - Chat title changed
 * - Pinned messages
 * - Voice chat events
 *
 * @param msg - Telegram API MessageService object
 * @param accountId - The Telegram account ID
 * @returns Unified message object marked as service type
 */
function parseService(
  msg: Api.MessageService,
  accountId: string
): UnifiedTelegramMessage {
  const { peerType, peerId, accessHash } = extractPeer(msg.peerId);
  const senderId = extractSenderId(msg.fromId);

  return {
    platform: "telegram",
    accountId,

    messageId: String(msg.id),
    chatId: peerId,

    peerType,
    peerId,
    accessHash: accessHash ?? null,

    senderId,

    date: new Date(msg.date * 1000).toISOString(),
    isOutgoing: msg.out ?? false,

    status: "sent",

    from: {
      id: senderId ?? "0",
      name: senderId ? "User" : "Unknown",
    },

    type: "service",
    text: msg.action?.className || "Service message",
  };
}

/* ========================================================================
   UNKNOWN / FALLBACK
   ======================================================================== */

function makeUnknown(accountId: string, id: number): UnifiedTelegramMessage {
  return {
    platform: "telegram",
    accountId,

    messageId: String(id),
    chatId: "0",

    peerType: "chat",
    peerId: "0",
    accessHash: null,

    senderId: null,

    date: new Date().toISOString(),
    isOutgoing: false,

    status: "failed",

    from: {
      id: "0",
      name: "Unknown",
    },

    type: "unknown",
    text: "",
  };
}

/* ========================================================================
   HELPERS
   ======================================================================== */

/**
 * Extracts sender user ID from a Telegram peer object
 *
 * @param peer - Telegram peer object (PeerUser, PeerChat, or PeerChannel)
 * @returns String user ID or null if not extractable
 */
function extractSenderId(peer: Api.TypePeer | null | undefined): string | null {
  if (!peer) return null;
  if (peer instanceof Api.PeerUser) return String(peer.userId);
  if (peer instanceof Api.PeerChat) return String(peer.chatId);
  if (peer instanceof Api.PeerChannel) return String(peer.channelId);
  return null;
}

/**
 * Extracts peer information (type, ID, access hash) from Telegram peer object
 *
 * Determines the peer type (user, chat, channel) and extracts the corresponding ID.
 * Access hashes are not available at this level and are set to null.
 *
 * @param peer - Telegram peer object
 * @returns Object containing peerType, peerId, and accessHash
 */
function extractPeer(peer: Api.TypePeer | null | undefined) {
  if (!peer)
    return {
      peerType: "chat" as const,
      peerId: "0",
      accessHash: null,
    };

  if (peer instanceof Api.PeerUser)
    return {
      peerType: "user" as const,
      peerId: String(peer.userId),
      accessHash: null,
    };

  if (peer instanceof Api.PeerChat)
    return {
      peerType: "chat" as const,
      peerId: String(peer.chatId),
      accessHash: null,
    };

  if (peer instanceof Api.PeerChannel)
    return {
      peerType: "channel" as const,
      peerId: String(peer.channelId),
      accessHash: null,
    };

  return { peerType: "chat" as const, peerId: "0", accessHash: null };
}

/**
 * Selects the best quality photo size from available sizes
 *
 * Prioritizes progressive photo sizes (which support streaming) and falls back
 * to selecting the largest available size based on width × height dimensions.
 *
 * @param sizes - Array of available photo sizes from Telegram
 * @returns Object containing width, height, and size in bytes
 */
function selectBestPhotoSize(sizes: Api.TypePhotoSize[]) {
  if (!sizes || sizes.length === 0) {
    return { w: 0, h: 0, size: null };
  }

  const progressive = sizes.find(
    (s) => s instanceof Api.PhotoSizeProgressive
  ) as Api.PhotoSizeProgressive | undefined;

  if (progressive) {
    return {
      w: progressive.w,
      h: progressive.h,
      size: progressive.sizes?.[progressive.sizes.length - 1] ?? null,
    };
  }

  let best: any = sizes[0];

  for (const s of sizes) {
    if ("w" in s && "h" in s) {
      if ((s.w ?? 0) * (s.h ?? 0) > (best.w ?? 0) * (best.h ?? 0)) {
        best = s;
      }
    }
  }

  return {
    w: best.w ?? 0,
    h: best.h ?? 0,
    size: (best as any).size ?? null,
  };
}
