// backend/types/telegram.types.ts

import { Api } from "telegram";
import type { BaseUnifiedChat } from "./unifiedChat.types";
import type { BaseUnifiedMessage } from "./unifiedMessage.types";
/** Result type returned by `sendCode` on success. */
export interface TelegramSendCodeResult {
  status: "code_sent"; // Indicates that the code was sent successfully
  phoneCodeHash: string; // Code hash to be used in `signIn`
  tempSession: string; // Temporary session string to be used in `signIn`
}

/** Result type returned by `signIn` when password is NOT required. */
export interface TelegramSignInOkResult {
  status: "ok";
  sessionString: string; // Valid session string to be saved
  user: Api.User; // MTProto User object
}

/** Result type returned by `signIn` when Telegram requires 2FA password. */
export interface TelegramSignInNeedPasswordResult {
  status: "need_password"; // Indicates that a password is required
  tempSession: string; // Temporary session string to be used in `signInWithPassword`
}

/** Result type returned by `signInWithPassword` on success (same shape as ok). */
export interface TelegramSignInWithPasswordResult {
  status: "ok"; // Indicates successful sign-in with password
  sessionString: string; // Valid session string to be saved
  user: Api.User; // MTProto User object
}

/** Result type returned by `saveSession`, indicating what happened to the account. */
export interface TelegramSaveSessionResult {
  status: "account_created" | "session_replaced"; // What action was taken
  accountId: string; // Local DB account id
}

/** Result type returned by `logout`. */
export interface TelegramLogoutResult {
  status: "ok"; // Indicates successful logout
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
  id: string;
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
