// frontend/src/types/telegram.types.ts

import type { BaseUnifiedChat } from "./unifiedChat.types";

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

export interface UnifiedTelegramChat extends BaseUnifiedChat {
  platform: "telegram";
  username?: string | null;
  phone?: string | null;
  verified?: boolean;
  isSelf?: boolean;
  folderId?: number | null;
  photo?: string | null;
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
