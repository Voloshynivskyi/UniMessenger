/** Project-wide account info shape for Telegram accounts (DB selection). */
export interface TelegramAccountInfo {
  id: string; // Unique identifier for the account
  telegramId: string; // Telegram user ID
  username: string | null; // Telegram username (handle)
  phoneNumber: string | null; // Phone number associated with the account
  firstName: string | null; // User's first name
  lastName: string | null; // User's last name
  isActive: boolean; // Whether the account is currently active
}

export interface UnifiedTelegramChat {
  id: string; // Telegram internal id (userId/chatId/channelId)
  title: string; // Chat name or user full name
  type: "user" | "group" | "supergroup" | "channel"; // Chat type
  username?: string | null; // Optional username/handle
  forum?: boolean; // If channel has forum topics
  pinned?: boolean; // If chat is pinned
  unreadCount?: number; // Unread messages
  lastMessage?: string; // Short text of last message (if loaded)
  lastMessageDate?: string; // ISO timestamp
  folderId?: number | null; // Telegram folder (if user uses folders)
}

/** Result type returned by `getDialogs`. */
export interface TelegramGetDialogsResult {
  status: "ok";
  dialogs: { dialogs: UnifiedTelegramChat[]; nextOffset?: NextOffset | null }; // Raw MTProto dialogs response
}

/** Next offset structure for pagination in `getDialogs`. */
export interface NextOffset {
  offsetDate?: number;
  offsetId?: number;
  offsetPeer?: {
    id: number;
    type: "user" | "chat" | "channel";
    accessHash?: string;
  };
}
