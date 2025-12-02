// backend/realtime/outgoingTempStore.ts

export interface OutgoingTempRecord {
  tempId: string | number;
  chatId: string;
  createdAt: number;
}

class OutgoingTempStore {
  // Map: "accountId:chatId" → FIFO queue of temp messages
  private queues = new Map<string, OutgoingTempRecord[]>();

  private key(accountId: string, chatId: string): string {
    return `${accountId}:${chatId}`;
  }

  /**
   * Push new temp outgoing message into FIFO queue
   */
  push(accountId: string, chatId: string, record: OutgoingTempRecord) {
    const k = this.key(accountId, chatId);
    const queue = this.queues.get(k) ?? [];
    queue.push(record);
    this.queues.set(k, queue);
  }

  /**
   * Pop oldest outgoing temp message for confirmation
   */
  shift(accountId: string, chatId: string): OutgoingTempRecord | null {
    const k = this.key(accountId, chatId);
    const queue = this.queues.get(k);
    if (!queue || queue.length === 0) return null;

    const record = queue.shift()!;
    this.queues.set(k, queue);
    return record;
  }

  /**
   * For debugging — list all pending temp messages for this chat
   */
  list(accountId: string, chatId: string): OutgoingTempRecord[] {
    const k = this.key(accountId, chatId);
    return this.queues.get(k) ?? [];
  }
}

export const outgoingTempStore = new OutgoingTempStore();
