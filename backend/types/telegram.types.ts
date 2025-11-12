import { Api } from "telegram";
import type { BaseUnifiedChat } from "./unifiedChat.types";
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

export interface UnifiedTelegramChat extends BaseUnifiedChat {
  platform: "telegram";
  username?: string | null;
  phone?: string | null;
  verified?: boolean;
  isSelf?: boolean;
  folderId?: number | null;
  photo?: string | null;
  peerType?: "user" | "chat" | "channel";
  accessHash?: string | undefined;
}

export interface TelegramGetDialogsResult {
  status: "ok";
  dialogs: UnifiedTelegramChat[];
  nextOffset?: any; // Raw MTProto dialogs response
}
