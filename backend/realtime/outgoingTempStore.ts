// backend/realtime/outgoingTempStore.ts

/**
 * Represents a temporary outgoing message record
 *
 * Used to track messages that have been sent but not yet confirmed by Telegram.
 * This allows matching server confirmations with optimistically displayed messages.
 */
export interface OutgoingTempRecord {
  tempId: string | number;
  text: string;
  chatId: string;
  createdAt: number;
}

/**
 * Temporary storage for outgoing messages awaiting confirmation
 *
 * This class manages a temporary store of messages that have been sent to Telegram
 * but haven't received a confirmation yet. It allows the application to:
 * - Track optimistically displayed messages
 * - Match server confirmations with local messages
 * - Handle message send failures
 *
 * Messages are keyed by account ID and temporary ID for efficient lookup.
 */
class OutgoingTempStore {
  private map = new Map<string, OutgoingTempRecord>();

  /**
   * Generates a unique key for storing outgoing message records
   *
   * @param accountId - The Telegram account ID
   * @param tempId - The temporary message ID
   * @returns Composite key in format "accountId:tempId"
   */
  makeKey(accountId: string, tempId: string | number): string {
    return `${accountId}:${tempId}`;
  }

  /**
   * Stores a new outgoing message record
   *
   * @param accountId - The Telegram account ID
   * @param tempId - The temporary message ID
   * @param text - The message text content
   * @param chatId - The chat ID where the message was sent
   */
  set(
    accountId: string,
    tempId: string | number,
    text: string,
    chatId: string
  ) {
    this.map.set(this.makeKey(accountId, tempId), {
      tempId,
      text,
      chatId,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieves an outgoing message record
   *
   * @param accountId - The Telegram account ID
   * @param tempId - The temporary message ID
   * @returns The stored record or null if not found
   */
  get(accountId: string, tempId: string | number): OutgoingTempRecord | null {
    return this.map.get(this.makeKey(accountId, tempId)) || null;
  }

  /**
   * Removes an outgoing message record from the store
   *
   * @param accountId - The Telegram account ID
   * @param tempId - The temporary message ID
   */
  remove(accountId: string, tempId: string | number) {
    this.map.delete(this.makeKey(accountId, tempId));
  }

  /**
   * Returns the first pending outgoing message for an account (FIFO)
   *
   * @param accountId - The Telegram account ID
   * @returns The first pending message or null if none exist
   */
  peek(accountId: string): OutgoingTempRecord | null {
    const entries = [...this.map.entries()].filter(([key]) =>
      key.startsWith(accountId + ":")
    );

    if (entries.length === 0) return null;

    const first = entries[0];
    if (!first) return null;

    return first[1];
  }

  /**
   * Returns all pending outgoing messages for an account
   *
   * @param accountId - The Telegram account ID
   * @returns Array of all pending message records
   */
  list(accountId: string): OutgoingTempRecord[] {
    return [...this.map.entries()]
      .filter(([key]) => key.startsWith(accountId + ":"))
      .map(([, value]) => value);
  }

  /**
   * Returns the key of the first pending outgoing message
   *
   * @param accountId - The Telegram account ID
   * @returns The first message key or null if none exist
   */
  firstKey(accountId: string): string | null {
    const entries = [...this.map.entries()].filter(([key]) =>
      key.startsWith(accountId + ":")
    );

    if (entries.length === 0) return null;

    const first = entries[0];
    if (!first) return null;

    return first[0];
  }
}

export const outgoingTempStore = new OutgoingTempStore();
