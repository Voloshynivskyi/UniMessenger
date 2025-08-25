// A tiny per-account WebSocket hub.
// Guarantees a single WS connection per sessionId, with auto-reconnect and fan-out to subscribers.

import { WS_BASE } from './http';

export type UpdatePayload =
  | { type: 'new_message'; data: any }
  | { type: 'raw'; data?: any; note?: string };

type Listener = (msg: UpdatePayload) => void;

type Pool = {
  sessionId: string;
  url: string;
  ws: WebSocket | null;
  listeners: Set<Listener>;
  backoff: number; // reconnect step
  timer: number | null;
  closedByUser: boolean;
};

class WsHub {
  private pools = new Map<string, Pool>();

  subscribe(sessionId: string, listener: Listener): () => void {
    let pool = this.pools.get(sessionId);
    if (!pool) {
      pool = {
        sessionId,
        url: `${WS_BASE()}/ws?sessionId=${encodeURIComponent(sessionId)}`,
        ws: null,
        listeners: new Set<Listener>(),
        backoff: 0,
        timer: null,
        closedByUser: false,
      };
      this.pools.set(sessionId, pool);
      this.connect(pool);
    }
    pool.listeners.add(listener);

    // Return unsubscribe
    return () => {
      const p = this.pools.get(sessionId);
      if (!p) return;
      p.listeners.delete(listener);
      if (p.listeners.size === 0) {
        // No more listeners → close gracefully and remove pool
        p.closedByUser = true;
        try { p.ws?.close(); } catch {}
        if (p.timer) {
          window.clearTimeout(p.timer);
          p.timer = null;
        }
        this.pools.delete(sessionId);
      }
    };
  }

  private connect(pool: Pool) {
    try {
      const ws = new WebSocket(pool.url);
      pool.ws = ws;

      ws.onopen = () => {
        pool.backoff = 0;
      };

      ws.onmessage = (ev) => {
        let payload: UpdatePayload | null = null;
        try {
          payload = JSON.parse(ev.data);
        } catch {
          payload = { type: 'raw', note: 'non-JSON message' };
        }
        if (!payload) return;
        for (const l of pool.listeners) {
          try { l(payload); } catch {}
        }
      };

      ws.onerror = () => {
        // avoid console noise here; onclose will schedule reconnect
      };

      ws.onclose = () => {
        if (pool.closedByUser) return;
        // exponential backoff up to 15s
        const delay = Math.min(1000 * Math.pow(2, pool.backoff++), 15000);
        pool.timer = window.setTimeout(() => this.connect(pool!), delay);
      };
    } catch {
      // Schedule retry if constructor throws
      if (pool.closedByUser) return;
      const delay = Math.min(1000 * Math.pow(2, pool.backoff++), 15000);
      pool.timer = window.setTimeout(() => this.connect(pool!), delay);
    }
  }
}

export const wsHub = new WsHub();
