// frontend/src/types/telegram.types.ts

import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";

export interface NextOffset {
  offsetDate: number;
  offsetId: number;
  offsetPeer?: {
    id: number;
    type: "user" | "chat" | "channel";
    accessHash?: string;
  };
}

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

/* ========================================================================
   Unified Telegram Chat
   ======================================================================== */

export interface TelegramGetDialogsResult {
  status: "ok";
  dialogs: UnifiedTelegramChat[];
  nextOffset?: any; // Raw MTProto dialogs response
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
  accessHash?: string | undefined;
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

export interface TelegramGetDialogsResult {
  status: "ok";
  dialogs: UnifiedTelegramChat[];
  nextOffset?: any;
}

/* ========================================================================
   Unified Telegram Message
   ======================================================================== */

export type UnifiedTelegramMessageType =
  | "text"
  | "photo"
  | "video"
  | "animation"
  | "voice"
  | "audio"
  | "video_note"
  | "file"
  | "sticker"
  | "service"
  | "unknown";

export interface TelegramMedia {
  id?: string;
  accessHash?: string | null;
  dcId?: number;
  size?: number | null;

  mimeType?: string;
  fileName?: string;

  width?: number;
  height?: number;
  duration?: number;

  isSticker?: boolean | undefined;
  isAnimated?: boolean | undefined;
  isRoundVideo?: boolean | undefined;

  waveform?: number[] | undefined;
  groupId?: string | null;

  /** Frontend-only optimistic preview URL */
  localPreviewUrl?: string;
}

/**
 * Telegram-specific unified message.
 * Extends the base structure with Telegram-only fields.
 */
export interface UnifiedTelegramMessage extends BaseUnifiedMessage {
  platform: "telegram";

  /** Who owns this message */
  accountId: string;

  /** Peer (chat) info */
  peerType?: "user" | "chat" | "channel";
  peerId?: string;
  accessHash?: string | null;

  /** Message identity */
  messageId: string;
  date: string; // ISO

  /** Sender identity */
  senderId?: string | null;

  /** Content */
  type: UnifiedTelegramMessageType;
  text?: string;
  media?: TelegramMedia | null;
}
