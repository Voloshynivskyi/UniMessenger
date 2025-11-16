import type { UnifiedChat } from "../../../types/unifiedChat.types";

/**
 * Returns sender name for display in group chats.
 *
 * Private chat (peerType = "user") → null
 * Channel (peerType = "channel") → null
 * Undefined peerType → null
 *
 * Group chats:
 *   - Outgoing → "You"
 *   - Incoming → sender name/username/id
 */
export function getSenderLabel(chat: UnifiedChat): string | null {
  const last = chat.lastMessage;
  if (!last) return null;

  // No sender in private chats or channels
  if (
    chat.peerType === "user" ||
    chat.peerType === "channel" ||
    chat.peerType === undefined
  ) {
    return null;
  }

  // Outgoing → "You"
  if (last.isOutgoing) {
    return "You";
  }

  // Incoming sender
  const from = last.from;
  if (!from) return null;

  const name =
    from.name?.trim() ||
    from.username?.trim() ||
    (from.id !== "0" ? from.id : null);

  return name || null;
}

/**
 * Determines whether UI should show sender.
 * Private chats and channels → false
 * Groups → true
 */
export function shouldShowSender(chat: UnifiedChat): boolean {
  if (chat.peerType === "user") return false;
  if (chat.peerType === "channel") return false;
  if (chat.peerType === undefined) return false;
  return true;
}
