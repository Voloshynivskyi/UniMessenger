// backend/realtime/outgoingTempStore.ts
export interface OutgoingTempRecord {
  tempId: string | number;
  text: string;
  chatId: string;
  createdAt: number;
}

class OutgoingTempStore {
  private map = new Map<string, OutgoingTempRecord>();

  makeKey(accountId: string, tempId: string | number): string {
    return `${accountId}:${tempId}`;
  }

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

  get(accountId: string, tempId: string | number): OutgoingTempRecord | null {
    return this.map.get(this.makeKey(accountId, tempId)) || null;
  }

  remove(accountId: string, tempId: string | number) {
    this.map.delete(this.makeKey(accountId, tempId));
  }

  /** Returns first pending outgoing (FIFO) */
  peek(accountId: string): OutgoingTempRecord | null {
    const entries = [...this.map.entries()].filter(([key]) =>
      key.startsWith(accountId + ":")
    );

    if (entries.length === 0) return null;

    const first = entries[0];
    if (!first) return null;

    return first[1];
  }

  list(accountId: string): OutgoingTempRecord[] {
    return [...this.map.entries()]
      .filter(([key]) => key.startsWith(accountId + ":"))
      .map(([, value]) => value);
  }

  /** Returns first pending outgoing key */
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
