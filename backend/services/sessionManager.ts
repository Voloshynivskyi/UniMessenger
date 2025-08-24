// File: backend/services/sessionManager.ts
// Manages long-lived TelegramClient instances and emits real-time updates.

import { EventEmitter } from 'events';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PrismaClient } from '@prisma/client';
import createDebug from 'debug';
import { decrypt } from '../utils/crypto';
// Correct event builders import for gramJS
import { NewMessage, Raw } from 'telegram/events';

const debug = createDebug('app:sessionManager');
const prisma = new PrismaClient();

type SessionId = string;

export interface UpdatePayload {
  type: 'new_message' | 'raw';
  data: any;
}

class SessionManager extends EventEmitter {
  // Map of sessionId -> live TelegramClient
  private clients = new Map<SessionId, TelegramClient>();
  // Prevent parallel connects for the same sessionId
  private connecting = new Set<SessionId>();

  /**
   * Ensure there is a long-lived TelegramClient for the given sessionId.
   * If it already exists, return it. Otherwise, create, connect and attach handlers.
   */
  public async ensureClient(sessionId: SessionId): Promise<TelegramClient> {
    const existing = this.clients.get(sessionId);
    if (existing) {
      // Try to reconnect if connection dropped temporarily
      try {
        // @ts-ignore gramJS exposes 'connected' at runtime
        if (!(existing as any).connected) {
          await existing.connect();
        }
      } catch (e) {
        debug('reconnect failed', sessionId, e);
      }
      return existing;
    }

    // Someone else is connecting this sessionId → wait for ready
    if (this.connecting.has(sessionId)) {
      await this.waitForReady(sessionId, 10_000);
      const ready = this.clients.get(sessionId);
      if (!ready) throw new Error('Client not ready after wait');
      return ready;
    }

    this.connecting.add(sessionId);
    try {
      // 1) Load encrypted session from DB
      const s = await prisma.session.findUnique({ where: { sessionId } });
      if (!s || !s.sessionString) throw new Error('Session not found or not authorized');

      // 2) Decrypt to StringSession
      const decrypted = decrypt(s.sessionString);

      // 3) Read MTProto credentials from env
      const apiId = Number(process.env.API_ID);
      const apiHash = process.env.API_HASH || '';
      if (!apiId || !apiHash) throw new Error('Missing API_ID/API_HASH');

      // 4) Create TelegramClient with aggressive reconnect policy
      const client = new TelegramClient(
        new StringSession(decrypted),
        apiId,
        apiHash,
        {
          connectionRetries: 999, // keep trying to reconnect
          retryDelay: 1500,
          useWSS: true,
        }
      );

      // 5) Connect once (client will keep reconnecting on its own)
      await client.connect();

      // 6) Attach update handlers (NewMessage, Raw)
      this.attachHandlers(sessionId, client);

      // 7) Save in the map
      this.clients.set(sessionId, client);
      debug('client ready', sessionId);

      return client;
    } finally {
      this.connecting.delete(sessionId);
    }
  }

  /**
   * Attach gramJS event handlers once per client.
   * - NewMessage: normalized payload for UI (id, out, peerKey, senderId, text, date).
   * - Raw: pass-through raw updates (read states, pins, edits, dialog changes, etc.).
   */
  private attachHandlers(sessionId: SessionId, client: TelegramClient) {
    // New incoming/outgoing messages
    (client as any).addEventHandler(async (event: any) => {
      try {
        const msg = event?.message ?? event;
        if (!msg) return;

        const payload: UpdatePayload = {
          type: 'new_message',
          data: this.toWireMessage(msg),
        };
        this.emitUpdate(sessionId, payload);
      } catch (e) {
        debug('new_message handler error', e);
      }
    }, new NewMessage({}));

    // Raw updates (read/unread, pins, edits, deletes, dialog changes)
    (client as any).addEventHandler((update: any) => {
      const payload: UpdatePayload = { type: 'raw', data: update };
      this.emitUpdate(sessionId, payload);
    }, new Raw({}));
  }

  /** Re-emit update for WS or other listeners (scoped by sessionId). */
  private emitUpdate(sessionId: SessionId, payload: UpdatePayload) {
    this.emit(`update:${sessionId}`, payload);
  }

  /** Wait until a client for sessionId appears in the map or timeout. */
  private async waitForReady(sessionId: SessionId, timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.clients.get(sessionId)) return;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /**
   * Restore all known sessions on server start (best-effort).
   * This keeps users "online" after restart so they continue to receive updates.
   */
  public async restoreAll() {
    const sessions = await prisma.session.findMany({
      where: { sessionString: { not: '' } },
      select: { sessionId: true },
    });

    for (const s of sessions) {
      try {
        await this.ensureClient(s.sessionId);
      } catch (e) {
        debug('restore failed', s.sessionId, e);
      }
    }
    debug('restoreAll done, count =', sessions.length);
  }

  // --------------------- Helpers: normalization ---------------------

  /** Build a transport-friendly payload for UI/WebSocket. */
  private toWireMessage(msg: any) {
    const id: number = Number(msg?.id ?? 0);
    const out: boolean = Boolean(msg?.out || msg?.isOut);
    const peerKey = this.toPeerKeyFromMsg(msg);
    const senderId = this.extractSenderId(msg);
    const text = this.extractText(msg);
    const date = this.extractDateISO(msg);

    return { id, out, peerKey, senderId, text, date };
  }

  /** Build peerKey like "user:123", "chat:456", "channel:789". */
  private toPeerKeyFromMsg(msg: any): string {
    const p = msg?.peerId || {};
    if (p.userId != null) return `user:${p.userId}`;
    if (p.chatId != null) return `chat:${p.chatId}`;
    if (p.channelId != null) return `channel:${p.channelId}`;
    // Fallbacks used by some gramJS versions
    if (msg?.chatId != null) return `chat:${msg.chatId}`;
    return '';
  }

  /** Extract sender id as string or null. */
  private extractSenderId(msg: any): string | null {
    const from = msg?.senderId || msg?.fromId;
    if (!from) return null;
    const id = from.userId ?? from.chatId ?? from.channelId ?? null;
    return id != null ? String(id) : null;
    // Note: for "out" messages, sender is "me" (null here; the client can infer).
  }

  /** Convert message date to ISO string. */
  private extractDateISO(msg: any): string | null {
    const d = msg?.date;
    if (!d) return null;
    if (d instanceof Date) return d.toISOString();
    if (typeof d === 'number') return new Date(d * 1000).toISOString();
    return null;
  }

  /** Extract readable text; short placeholders for media/service. */
  private extractText(msg: any): string {
    // Service actions (join/left/etc.)
    if (msg?.action) return '[service message]';

    // Plain text
    if (typeof msg?.message === 'string' && msg.message.trim().length) {
      return msg.message;
    }

    // Media placeholders
    const m = msg?.media;
    const className: string | undefined = m?.className;
    if (className?.includes('Photo')) return '[photo]';
    if (className?.includes('Document')) return '[document]';
    if (className?.includes('Geo')) return '[location]';
    if (className?.includes('Contact')) return '[contact]';
    if (className?.includes('Dice')) return '[dice]';

    return '';
  }
}

export const sessionManager = new SessionManager();
