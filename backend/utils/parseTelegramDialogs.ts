import { Api } from "telegram";
import type { UnifiedTelegramChat } from "../types/telegram.types";

/**
 * Checks if this is a full dialog structure (Dialogs or DialogsSlice)
 */
function isFullDialog(
  d: Api.messages.TypeDialogs
): d is Api.messages.Dialogs | Api.messages.DialogsSlice {
  return (
    d instanceof Api.messages.Dialogs || d instanceof Api.messages.DialogsSlice
  );
}

/**
 * Get user display name
 */
function getUserDisplayName(user?: Api.TypeUser): string {
  if (!user) return "Unknown";
  if (user instanceof Api.User) {
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return name || user.username || "Unknown";
  }
  return "Unknown";
}

/**
 * Detect message type based on its content
 */
function detectMessageType(
  msg: Api.Message
): NonNullable<UnifiedTelegramChat["lastMessage"]>["type"] {
  if (msg.media instanceof Api.MessageMediaPhoto) return "photo";

  if (msg.media instanceof Api.MessageMediaDocument) {
    const doc = msg.media.document;
    if (doc instanceof Api.Document) {
      const mime = doc.mimeType ?? "";
      if (mime.startsWith("video")) return "video";
      if (mime.startsWith("audio") || mime.includes("voice")) return "voice";
      if (mime.includes("sticker")) return "sticker";
      return "file";
    }
    return "file";
  }

  if (msg.media instanceof Api.MessageMediaWebPage) return "link";
  if (msg.action) return "service";
  if (msg.message) return "text";

  return "unknown";
}

/**
 * Replace message text if the type is not text
 */
function messageSummaryByType(type?: string): string {
  switch (type) {
    case "photo":
      return "📷 Photo";
    case "video":
      return "🎬 Video";
    case "voice":
      return "🎙 Voice message";
    case "sticker":
      return "💬 Sticker";
    case "file":
      return "📎 File";
    case "link":
      return "🔗 Link";
    case "service":
      return "⚙️ Service message";
    default:
      return "";
  }
}

/**
 * Main function — parsing dialogs into a unified format
 */
export function parseTelegramDialogs(dialogs: Api.messages.TypeDialogs): {
  dialogs: UnifiedTelegramChat[];
  nextOffset?: any;
} {
  if (!isFullDialog(dialogs)) {
    console.warn(
      "[parseTelegramDialogs] Unsupported dialog type:",
      dialogs.constructor.name
    );
    return { dialogs: [] };
  }

  const userMap = new Map<number, Api.TypeUser>(
    dialogs.users.map((u) => [Number(u.id), u])
  );
  const chatMap = new Map<number, Api.TypeChat>(
    dialogs.chats.map((c) => [Number(c.id), c])
  );
  const msgMap = new Map<number, Api.TypeMessage>(
    dialogs.messages.map((m) => [Number(m.id), m])
  );

  const parsed: UnifiedTelegramChat[] = [];

  for (const d of dialogs.dialogs) {
    let peerType: "user" | "group" | "supergroup" | "channel" = "user";
    let entity: Api.User | Api.Chat | Api.Channel | undefined;

    if (d.peer instanceof Api.PeerUser) {
      entity = userMap.get(Number(d.peer.userId)) as Api.User;
    } else if (d.peer instanceof Api.PeerChat) {
      peerType = "group";
      entity = chatMap.get(Number(d.peer.chatId)) as Api.Chat;
    } else if (d.peer instanceof Api.PeerChannel) {
      const ch = chatMap.get(Number(d.peer.channelId)) as Api.Channel;
      peerType = ch?.megagroup ? "supergroup" : "channel";
      entity = ch;
    }

    if (!entity) continue;

    const topMsg = d.topMessage ? msgMap.get(Number(d.topMessage)) : null;
    let lastMessage: UnifiedTelegramChat["lastMessage"] | undefined = undefined;

    if (topMsg instanceof Api.Message) {
      const msgType = detectMessageType(topMsg);
      const fromPeer = topMsg.fromId;
      let fromUser: Api.TypeUser | undefined;

      if (fromPeer instanceof Api.PeerUser) {
        fromUser = userMap.get(Number(fromPeer.userId));
      }

      const senderName = getUserDisplayName(fromUser);
      const senderUsername =
        fromUser instanceof Api.User ? fromUser.username ?? null : null;

      lastMessage = {
        id: String(topMsg.id),
        text: topMsg.message || messageSummaryByType(msgType),
        type: msgType,
        date: new Date(topMsg.date * 1000).toISOString(),
        from: {
          id: fromPeer
            ? String(
                (fromPeer as any).userId ||
                  (fromPeer as any).chatId ||
                  (fromPeer as any).channelId ||
                  0
              )
            : "0",
          name: senderName,
          username: senderUsername,
        },
        isOutgoing: !!topMsg.out,
      };
    }

    const title =
      "title" in entity
        ? entity.title
        : `${(entity as Api.User).firstName ?? ""} ${
            (entity as Api.User).lastName ?? ""
          }`.trim() ||
          entity?.username ||
          "Unknown";

    let displayName: string;

    if (entity instanceof Api.User) {
      // If this is a user
      displayName =
        `${entity.firstName ?? ""} ${entity.lastName ?? ""}`.trim() ||
        entity.username ||
        (entity.phone ? `+${entity.phone}` : `ID ${entity.id}`) ||
        "Unknown";
    } else if ("title" in entity) {
      // If this is a group or channel
      displayName =
        entity.title ||
        (entity as any).username ||
        (entity as any).id?.toString?.() ||
        "Unknown";
    } else {
      // fallback
      displayName = "Unknown";
    }

    let photo: string | null = null;
    if ("photo" in entity && entity.photo) {
      const p = entity.photo as any;
      photo = p?.photoId?.toString?.() ?? null;
    }

    // === TypeScript-safe object formation ===
    const baseChat: UnifiedTelegramChat = {
      platform: "telegram", // 👈 add platform
      accountId: "telegram-" + String(entity.id), // can be real account ID
      chatId: String(entity.id),
      title,
      displayName,
      username: "username" in entity ? entity.username ?? null : null,
      phone: "phone" in entity ? entity.phone ?? null : null,
      verified: "verified" in entity ? !!entity.verified : false,
      isSelf: "self" in entity ? !!entity.self : false,
      pinned: Boolean((d as any).pinned),
      unreadCount: (d as any).unreadCount ?? 0,
      photo,
      folderId: (d as any).folderId ?? null,
    };

    if (lastMessage) {
      baseChat.lastMessage = lastMessage;
    }

    parsed.push(baseChat);
  }

  // === pagination offset ===
  let nextOffset: any = undefined;
  const lastDialog = dialogs.dialogs[dialogs.dialogs.length - 1];

  // try to find a valid last dialog with to get correct offset
  let validLastDialog = lastDialog;
  for (let i = dialogs.dialogs.length - 1; i >= 0; i--) {
    const candidate = dialogs.dialogs[i];
    if (candidate?.topMessage) {
      const msgCandidate = msgMap.get(Number(candidate.topMessage));
      if (msgCandidate instanceof Api.Message && msgCandidate.date) {
        validLastDialog = candidate;
        break;
      }
    }
  }

  // if valid dialog found — use it instead
  if (validLastDialog && validLastDialog.peer && validLastDialog.topMessage) {
    const topMsg = msgMap.get(Number(validLastDialog.topMessage));
    const peer = validLastDialog.peer;

    if (topMsg instanceof Api.Message && topMsg.date) {
      nextOffset = {
        offsetId: Number(validLastDialog.topMessage),
        offsetDate: topMsg.date,
        offsetPeer:
          peer instanceof Api.PeerUser
            ? { id: peer.userId, type: "user" }
            : peer instanceof Api.PeerChat
            ? { id: peer.chatId, type: "chat" }
            : peer instanceof Api.PeerChannel
            ? { id: peer.channelId, type: "channel" }
            : null,
      };
    }
  }
  if (lastDialog && lastDialog.peer && lastDialog.topMessage) {
    const topMsg = msgMap.get(Number(lastDialog.topMessage));
    const peer = lastDialog.peer;

    if (topMsg instanceof Api.Message && topMsg.date) {
      let offsetPeer: {
        id: number;
        type: "user" | "chat" | "channel";
        accessHash?: string;
      } | null = null;

      if (peer instanceof Api.PeerUser) {
        const user = userMap.get(Number(peer.userId)) as Api.User | undefined;
        offsetPeer = {
          id: Number(peer.userId),
          type: "user",
          ...(user?.accessHash ? { accessHash: String(user.accessHash) } : {}),
        };
      } else if (peer instanceof Api.PeerChat) {
        offsetPeer = {
          id: Number(peer.chatId),
          type: "chat",
        };
      } else if (peer instanceof Api.PeerChannel) {
        const channel = chatMap.get(Number(peer.channelId)) as
          | Api.Channel
          | undefined;
        offsetPeer = {
          id: Number(peer.channelId),
          type: "channel",
          ...(channel?.accessHash
            ? { accessHash: String(channel.accessHash) }
            : {}),
        };
      }

      // ✅ return proper offset structure
      nextOffset = {
        offsetId: Number(lastDialog.topMessage),
        offsetDate: topMsg.date,
        offsetPeer,
      };
    }
  }
  console.debug(
    "[parseTelegramDialogs] dialogs type:",
    dialogs.constructor.name,
    "dialogs count:",
    (dialogs as any).dialogs?.length ?? 0,
    "nextOffset:",
    nextOffset
  );
  return { dialogs: parsed, nextOffset };
}
