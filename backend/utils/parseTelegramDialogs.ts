// backend/utils/parseTelegramDialogs.ts
import { Api } from "telegram";
import type { UnifiedTelegramChat } from "../services/telegram/telegram.types";

function isFullDialog(
  d: Api.messages.TypeDialogs
): d is Api.messages.Dialogs | Api.messages.DialogsSlice {
  return (
    d instanceof Api.messages.Dialogs || d instanceof Api.messages.DialogsSlice
  );
}

/**
 * Converts raw MTProto dialog response to normalized chat summaries.
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

    // Determine peer type
    if (d.peer instanceof Api.PeerUser) {
      const u = userMap.get(Number(d.peer.userId));
      if (u instanceof Api.User) {
        peerType = "user";
        entity = u;
      }
    } else if (d.peer instanceof Api.PeerChat) {
      const c = chatMap.get(Number(d.peer.chatId));
      if (c instanceof Api.Chat) {
        peerType = "group";
        entity = c;
      }
    } else if (d.peer instanceof Api.PeerChannel) {
      const ch = chatMap.get(Number(d.peer.channelId));
      if (ch instanceof Api.Channel) {
        peerType = ch.megagroup ? "supergroup" : "channel";
        entity = ch;
      }
    }

    if (!entity) continue;

    const topMsgRaw = d.topMessage ? msgMap.get(Number(d.topMessage)) : null;
    const topMsg = topMsgRaw instanceof Api.Message ? topMsgRaw : undefined;

    parsed.push({
      id: String(entity.id),
      title:
        "title" in entity
          ? entity.title
          : `${(entity as Api.User).firstName ?? ""} ${
              (entity as Api.User).lastName ?? ""
            }`.trim(),
      type: peerType,
      username: "username" in entity ? entity.username ?? null : null,
      forum: !!(entity as any).forum,
      pinned: Boolean((d as any).pinned),
      unreadCount: (d as any).unreadCount ?? 0,
      lastMessage: topMsg?.message ?? "",
      lastMessageDate: topMsg?.date
        ? new Date(topMsg.date * 1000).toISOString()
        : "",
      folderId: (d as any).folderId ?? null,
    });
  }

  // Build next offset for pagination
  let nextOffset: any = undefined;
  const lastDialog = dialogs.dialogs[dialogs.dialogs.length - 1];
  if (lastDialog && lastDialog.peer && lastDialog.topMessage) {
    const topMsg = msgMap.get(Number(lastDialog.topMessage));
    const peer = lastDialog.peer;

    if (topMsg instanceof Api.Message && topMsg.date) {
      nextOffset = {
        id: lastDialog.topMessage,
        date: topMsg.date,
        peer:
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

  return { dialogs: parsed, nextOffset };
}
