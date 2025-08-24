// File: backend/services/sessionManager.ts
// Manages long-lived TelegramClient instances and emits real-time updates.

import { EventEmitter } from 'events';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PrismaClient } from '@prisma/client';
import createDebug from 'debug';
import { decrypt } from '../utils/crypto';
import { NewMessage, Raw } from 'telegram/events';

const debug = createDebug('app:sessionManager');
const prisma = new PrismaClient();

type SessionId = string;

export interface UpdatePayload {
  type: 'new_message' | 'raw';
  data: any;
}

function fingerprint(sessionString: string): string {
  // Lightweight fingerprint without crypto dependency
  // (it's fine to use the first 48 chars; they are stable and sufficient)
  return sessionString.slice(0, 48);
}

class SessionManager extends EventEmitter {
  // sessionId -> live TelegramClient
  private clients = new Map<SessionId, TelegramClient>();
  // to avoid parallel connects for the same sessionId
  private connecting = new Set<SessionId>();
  // sessionId -> fingerprint of sessionString used by live client
  private fp = new Map<SessionId, string>();

  /**
   * Ensure there is a long-lived TelegramClient for the given sessionId.
   * If an existing client uses a different sessionString than DB -> recreate it.
   */
  public async ensureClient(sessionId: SessionId): Promise<TelegramClient> {
    // 1) Load DB row each time to compare sessionString with running client
    const row = await prisma.session.findUnique({ where: { sessionId } });
    if (!row) {
      const err: any = new Error(`Session row not found in DB: ${sessionId}`);
      err.code = 'NO_DB_ROW';
      throw err;
    }
    if (!row.sessionString || row.sessionString.length === 0) {
      throw new Error('Session not found or not authorized');
    }

    const decrypted = decrypt(row.sessionString);
    const dbFp = fingerprint(decrypted);

    // 2) If a client exists, check if its session matches DB; otherwise replace
    const existing = this.clients.get(sessionId);
    if (existing) {
      try {
        const activeSaved = (existing.session as StringSession).save();
        const activeFp = fingerprint(activeSaved);
        if (activeFp !== dbFp) {
          debug('sessionString changed; recreating client', { sessionId });
          await this.safeDispose(sessionId, existing);
        } else {
          // Keep the client; reconnect if needed
          // @ts-ignore gramJS runtime flag
          if (!(existing as any).connected) {
            try { await existing.connect(); } catch (e) { debug('reconnect failed', sessionId, e); }
          }
          return existing;
        }
      } catch {
        // If anything goes wrong reading active session -> recreate
        console.log('[sessionManager] sessionString changed — recreating client for', sessionId);
        await this.safeDispose(sessionId, existing);
      }
    }

    // 3) Avoid double creation when many callers race
    if (this.connecting.has(sessionId)) {
      await this.waitForReady(sessionId, 10_000);
      const ready = this.clients.get(sessionId);
      if (!ready) throw new Error('Client not ready after wait');
      return ready;
    }

    this.connecting.add(sessionId);
    try {
      const apiId = Number(process.env.API_ID);
      const apiHash = process.env.API_HASH || '';
      if (!apiId || !apiHash) throw new Error('Missing API_ID/API_HASH');

      const client = new TelegramClient(
        new StringSession(decrypted),
        apiId,
        apiHash,
        {
          connectionRetries: 999,
          retryDelay: 1500,
          useWSS: true,
        }
      );

      await client.connect();
      this.attachHandlers(sessionId, client);

      this.clients.set(sessionId, client);
      this.fp.set(sessionId, dbFp);
      debug('client ready', sessionId);

      return client;
    } finally {
      this.connecting.delete(sessionId);
    }
  }

  /** Dispose existing client for a sessionId safely. */
  private async safeDispose(sessionId: SessionId, client: TelegramClient) {
    try { await client.disconnect(); } catch {}
    try { await client.destroy?.(); } catch {}
    this.clients.delete(sessionId);
    this.fp.delete(sessionId);
  }

  /**
   * Attach gramJS event handlers once per client.
   * - NewMessage: normalized payload for UI (id, out, peerKey, senderId, text, date).
   * - Raw: pass-through raw updates (read states, pins, edits, deletes, dialog changes, etc.).
   */
  private attachHandlers(sessionId: SessionId, client: TelegramClient) {
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

    (client as any).addEventHandler((update: any) => {
      const payload: UpdatePayload = { type: 'raw', data: update };
      this.emitUpdate(sessionId, payload);
    }, new Raw({}));
    const updates = (client as any)._updates;

    if (updates?.on) {
      updates.on('error', (err: any) => {
        const msg = String(err?.message || err || '');
        if (msg.includes('TIMEOUT')) return;
        console.error('[gramjs updates error]', msg);
      });
    }
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

  /** Restore all known sessions on server start (best-effort). */
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
    if (msg?.chatId != null) return `chat:${msg.chatId}`;
    return '';
  }

  /** Extract sender id as string or null. */
  private extractSenderId(msg: any): string | null {
    const from = msg?.senderId || msg?.fromId;
    if (!from) return null;
    const id = from.userId ?? from.chatId ?? from.channelId ?? null;
    return id != null ? String(id) : null;
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
    if (msg?.action) return '[service message]';
    if (typeof msg?.message === 'string' && msg.message.trim().length) {
      return msg.message;
    }
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
