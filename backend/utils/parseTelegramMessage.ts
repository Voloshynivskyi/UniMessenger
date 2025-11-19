import { Api } from "telegram";
import type { UnifiedTelegramMessage } from "../types/telegram.types";

/* ============================================================
   MAIN PARSER FUNCTION
   ============================================================ */

export function parseTelegramMessage(
  msg: Api.TypeMessage,
  accountId: string
): UnifiedTelegramMessage {
  // MESSAGE EMPTY → treat as unknown
  if (msg instanceof Api.MessageEmpty) {
    return {
      platform: "telegram",
      accountId,
      messageId: Number(msg.id),
      chatId: "unknown",
      type: "unknown",
      text: "",
      date: 0,
      isOutgoing: false,
      from: { id: "0", name: "Unknown" },
    };
  }

  // SERVICE
  if (msg instanceof Api.MessageService) {
    return parseServiceMessage(msg, accountId);
  }

  // NORMAL
  if (msg instanceof Api.Message) {
    return parseNormalMessage(msg, accountId);
  }

  // FALLBACK
  return {
    platform: "telegram",
    accountId,
    messageId: Date.now(),
    chatId: "unknown",
    type: "unknown",
    text: "",
    date: 0,
    isOutgoing: false,
    from: { id: "0", name: "Unknown" },
  };
}

/* ============================================================
   NORMAL MESSAGE
   ============================================================ */

function parseNormalMessage(
  msg: Api.Message,
  accountId: string
): UnifiedTelegramMessage {
  const base = {
    platform: "telegram" as const,
    accountId,
    messageId: Number(msg.id),
    chatId: extractChatId(msg.peerId),
    text: msg.message || "",
    date: msg.date * 1000,
    isOutgoing: msg.out ?? false,
    from: extractSender(msg.fromId),
  };

  // TEXT
  if (!msg.media) {
    return { ...base, type: "text" };
  }

  const media = msg.media;

  // PHOTO
  if (
    media instanceof Api.MessageMediaPhoto &&
    media.photo instanceof Api.Photo
  ) {
    const photo = media.photo;
    const best = selectBestPhotoSize(photo.sizes);

    return {
      ...base,
      type: "photo",
      media: {
        photo: {
          id: String(photo.id),
          accessHash: String(photo.accessHash),
          dcId: photo.dcId,
          width: best.w,
          height: best.h,
          size: best.size,
        },
      },
    };
  }

  // Other media types later…
  return { ...base, type: "unknown" };
}

/* ============================================================
   SERVICE MESSAGE
   ============================================================ */

function parseServiceMessage(
  msg: Api.MessageService,
  accountId: string
): UnifiedTelegramMessage {
  return {
    platform: "telegram",
    accountId,
    messageId: Number(msg.id),
    chatId: extractChatId(msg.peerId),
    type: "service",
    text: msg.action?.className || "Service message",
    date: msg.date * 1000,
    isOutgoing: msg.out ?? false,
    from: extractSender(msg.fromId),
  };
}

/* ============================================================
   EXTRACT SENDER
   ============================================================ */

function extractSender(peer: Api.TypePeer | null | undefined) {
  if (!peer) return { id: "0", name: "Unknown" };

  if (peer instanceof Api.PeerUser)
    return { id: String(peer.userId), name: "User" };

  if (peer instanceof Api.PeerChat)
    return { id: String(peer.chatId), name: "Chat" };

  if (peer instanceof Api.PeerChannel)
    return { id: String(peer.channelId), name: "Channel" };

  return { id: "0", name: "Unknown" };
}

/* ============================================================
   CHAT ID
   ============================================================ */

function extractChatId(peer: Api.TypePeer | null | undefined): string {
  if (!peer) return "unknown";

  if (peer instanceof Api.PeerUser) return String(peer.userId);
  if (peer instanceof Api.PeerChat) return String(peer.chatId);
  if (peer instanceof Api.PeerChannel) return String(peer.channelId);

  return "unknown";
}

/* ============================================================
   BEST PHOTO SIZE
   ============================================================ */

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

  let best = sizes[0] as any;

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
