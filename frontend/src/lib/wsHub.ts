// File: frontend/src/lib/wsHub.ts
// Purpose: Robust WebSocket hub with per-session connections, auto-reconnect,
//          and stable subscribe/unsubscribe API.
// Notes:
// - Server path is /ws and expects ?sessionId=... query.
// - We derive base from WS_BASE() and append '/ws' to keep config in one place.
// - Prevents "closed before established" by never calling .close() during CONNECTING,
//   and by debouncing reconnects. If manualClose happens while CONNECTING,
//   we immediately close right after onopen.
//
// Public API:
//   ensureSessionSocket(sessionId): Connection
//   onSessionUpdate(sessionId, listener): () => void
//   closeSessionSocket(sessionId): void
//
// Legacy compatibility exports (for existing imports):
//   export type UpdatePayload
//   export const wsHub = { ensureSessionSocket, onSessionUpdate, closeSessionSocket }
//
// Message delivery: we forward raw `event.data` parsed as JSON if possible,
// otherwise as string. We do not assume payload shape.

import { WS_BASE } from './http';

type Listener = (payload: any) => void;

export type UpdatePayload = {
  // Minimal, permissive shape to satisfy legacy type imports
  type?: string;
  data?: any;
  [k: string]: any;
};

type State = 'idle' | 'connecting' | 'open' | 'closed';

type Connection = {
  state(): State;
  subscribe(fn: Listener): () => void;
  close(): void;
};

type InternalConn = {
  ws: WebSocket | null;
  sessionId: string;
  listeners: Set<Listener>;
  state: State;
  reconnectTimer: number | null;
  attempts: number;
  manualClose: boolean;
};

const CONNS = new Map<string, InternalConn>();

function wsUrl(sessionId: string): string {
  // Build ws(s)://host[:port]/ws?sessionId=...
  const base = WS_BASE(); // e.g. ws://localhost:7007
  const u = new URL(base);
  const clean = u.pathname.replace(/\/+$/, '');
  u.pathname = `${clean}/ws`; // always append /ws
  u.searchParams.set('sessionId', sessionId);
  return u.toString();
}

function scheduleReconnect(c: InternalConn) {
  if (c.manualClose) return;
  if (c.reconnectTimer != null) return;

  // Exponential backoff: 300ms .. 10s
  const delay = Math.min(10000, 300 * Math.pow(2, c.attempts));
  c.reconnectTimer = window.setTimeout(() => {
    c.reconnectTimer = null;
    connect(c);
  }, delay);
}

function connect(c: InternalConn) {
  if (c.manualClose) return;
  if (c.state === 'connecting' || c.state === 'open') return;

  c.state = 'connecting';
  c.attempts++;

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl(c.sessionId));
  } catch {
    c.state = 'closed';
    scheduleReconnect(c);
    return;
  }

  c.ws = ws;

  ws.onopen = () => {
    if (c.manualClose) {
      // If user requested close during CONNECTING, close immediately after open
      try { ws.close(); } catch { /* no-op */ }
      return;
    }
    c.state = 'open';
    c.attempts = 0;
  };

  ws.onmessage = (ev) => {
    let data: any = ev.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // keep as string
      }
    }
    for (const fn of c.listeners) {
      try { fn(data); } catch { /* no-op */ }
    }
  };

  ws.onerror = () => {
    // onclose will follow; avoid double handling
  };

  ws.onclose = () => {
    c.state = 'closed';
    c.ws = null;
    if (!c.manualClose) scheduleReconnect(c);
  };
}

function getOrCreate(sessionId: string): InternalConn {
  let c = CONNS.get(sessionId);
  if (c) return c;

  c = {
    ws: null,
    sessionId,
    listeners: new Set<Listener>(),
    state: 'idle',
    reconnectTimer: null,
    attempts: 0,
    manualClose: false,
  };
  CONNS.set(sessionId, c);
  connect(c);
  return c;
}

export function ensureSessionSocket(sessionId: string): Connection {
  const c = getOrCreate(sessionId);
  return {
    state: () => c.state,
    subscribe(fn: Listener) {
      c.listeners.add(fn);
      return () => {
        c.listeners.delete(fn);
      };
    },
    close() {
      c.manualClose = true;
      if (c.reconnectTimer != null) {
        clearTimeout(c.reconnectTimer);
        c.reconnectTimer = null;
      }
      if (c.ws) {
        if (c.state === 'open') {
          try { c.ws.close(); } catch { /* no-op */ }
        }
        c.ws = null;
      }
      c.state = 'closed';
      CONNS.delete(c.sessionId);
    },
  };
}

/** Subscribe to updates for a sessionId; returns unsubscribe fn. */
export function onSessionUpdate(sessionId: string, listener: Listener): () => void {
  const conn = ensureSessionSocket(sessionId);
  return conn.subscribe(listener);
}

/** Force-close and remove connection for sessionId. */
export function closeSessionSocket(sessionId: string): void {
  const c = CONNS.get(sessionId);
  if (!c) return;
  c.manualClose = true;
  if (c.reconnectTimer != null) {
    clearTimeout(c.reconnectTimer);
    c.reconnectTimer = null;
  }
  if (c.ws && c.state === 'open') {
    try { c.ws.close(); } catch { /* no-op */ }
  }
  c.ws = null;
  c.state = 'closed';
  CONNS.delete(sessionId);
}

// ---- Legacy compatibility object export ------------------------------------

export const wsHub = {
  ensureSessionSocket,
  onSessionUpdate,
  closeSessionSocket,
};
