import type { UnifiedTelegramChat } from "../../../types/telegram.types";
import type UnifiedChat from "../types/UnifiedChat";

export function toUnifiedChat(
  telegramDialogOrArray: UnifiedTelegramChat | UnifiedTelegramChat[]
): UnifiedChat | UnifiedChat[] {
  if (Array.isArray(telegramDialogOrArray)) {
    return telegramDialogOrArray.map((dialog) => ({
      id: dialog.id,
      platform: "telegram",
      title: dialog.title,
      lastMessage: dialog.lastMessage || "",
      lastMessageDate: dialog.lastMessageDate || "",
      unreadCount: dialog.unreadCount,
      pinned: dialog.pinned,
    }));
  }

  const telegramDialog = telegramDialogOrArray;
  return {
    id: telegramDialog.id,
    platform: "telegram",
    title: telegramDialog.title,
    lastMessage: telegramDialog.lastMessage || "",
    lastMessageDate: telegramDialog.lastMessageDate || "",
    unreadCount: telegramDialog.unreadCount,
    pinned: telegramDialog.pinned,
  };
}
