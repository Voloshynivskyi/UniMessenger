// frontend/src/types/telegram.types.ts

import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";

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

  /** Telegram username for user/chat/channel */
  username?: string | null;

  /** User phone (if available) */
  phone?: string | null;

  /** Verified user or channel */
  verified?: boolean;

  /** Is this the user's own account */
  isSelf?: boolean;

  /** Folder where dialog belongs (Archived, Folders) */
  folderId?: number | null;

  /** Photo ID (we might resolve it later to URL) */
  photo?: string | null;

  /** Peer type (Telegram-specific but also exists in base) */
  peerType?: "user" | "chat" | "channel";

  /** Access hash for API calls */
  accessHash?: string;

  /** Mentions counter */
  unreadMentionsCount?: number;

  /** Reaction unread counter */
  unreadReactionsCount?: number;

  /** Telegram mute status */
  isMuted?: boolean;

  /** Exact mute timestamp (from notify settings) */
  muteUntil?: number | null;

  /** Whether previews are shown */
  showPreviews?: boolean | null;

  /** Supersets of channels */
  isMegagroup?: boolean;
  isBroadcast?: boolean;
  isForum?: boolean;

  /** Draft text and date */
  draft?: {
    text: string;
    date: string;
  } | null;
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

/**
 * Telegram-specific unified message.
 * Extends the base structure with Telegram-only fields.
 */
export interface UnifiedTelegramMessage extends BaseUnifiedMessage {
  platform: "telegram";

  type:
    | "text"
    | "photo"
    | "video"
    | "voice"
    | "file"
    | "sticker"
    | "service"
    | "unknown";

  media?: {
    photo?: {
      id: string;
      accessHash: string;
      dcId: number;
      width: number;
      height: number;
      size: number | null;
    };
  };
}
