// frontend/src/pages/inbox/utils/chatUtils.ts
import type { UnifiedChat } from "../../../types/unifiedChat.types";

/* ============================================================
   SENDER LABEL (last message)
============================================================ */
export function getSenderLabel(chat: UnifiedChat): string | null {
  const last = chat.lastMessage;
  if (!last?.from?.name) return null;

  if (chat.peerType === "user" || chat.peerType === "channel") {
    return null;
  }

  if (last.isOutgoing) return "You";

  const from = last.from;
  if (!from) return null;

  return (
    from.name?.trim() ||
    from.username?.trim() ||
    (from.id !== "0" ? from.id : null)
  );
}

/* ============================================================
   TIME LABEL
============================================================ */
export function formatTimeLabel(dateStr?: string): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const dayIndex = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  if (date >= start && date <= end) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ============================================================
   TYPING LABEL —  only name from backend to reduce payload size
============================================================ */
export function formatTypingLabel(
  chat: UnifiedChat,
  typing?: { users: { id: string; name: string }[] }
): string | null {
  if (!typing || typing.users.length === 0) return null;

  if (chat.peerType === "channel") return null;

  // Private
  if (chat.peerType === "user") {
    return "typing";
  }

  const names = typing.users.map((u) => u.name || u.id);

  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]}, ${names[1]} are typing`;

  return `${names[0]}, ${names[1]}… are typing`;
}
