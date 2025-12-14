export type Platform = "telegram" | "discord";

export interface ChatTarget {
  /** platform:accountId:chatId */
  targetKey: string;

  platform: Platform;

  /** telegram accountId OR discord botId */
  accountId: string;

  /** chat / channel / thread id */
  chatId: string;

  /** UI-only fields */
  title: string;
  subtitle?: string;

  /** Telegram only */
  peerType?: "user" | "chat" | "channel";

  /**
   * Telegram ONLY
   * REQUIRED for peerType = user
   */
  accessHash?: string | null;

  /** Discord only */
  threadId?: string | null;

  /**
   * UI guard
   * false → cannot be selected
   */
  disabled?: boolean;
  disabledReason?: string;
}
