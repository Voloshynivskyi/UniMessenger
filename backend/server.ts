// File: backend/server.ts
// Express HTTP + WebSocket server, wired to current SessionManager.
//
// - Robust .env loading with fallback (backend/.env -> project .env)
// - WebSocketServer at /ws bridges SessionManager events
// - Safe JSON packing for payloads (removes cycles / 'client' refs)
// - CORS enabled for Vite (:5173)
// - Routes mounted under '/api/*'
// - TELEGRAM_SESSION env is explicitly ignored (security)

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';

import telegramAuthRoutes from './routes/telegramAuth';
import telegramSessionRoutes from './routes/telegramSession';
import telegramChatsRoutes from './routes/telegramChats';
import telegramMessagesRoutes from './routes/telegramMessages';
import telegramSendRoutes from './routes/telegramSend';
import telegramHealthRoutes from './routes/telegramHealth';
import debugSessionsRoutes from './routes/debugSessions';

import { sessionManager } from './services/sessionManager';
import { rateLimitBySession } from './middleware/rateLimit';

// ----- Load env with fallback -----
(function loadEnvFallback() {
  const candidates = [
    path.resolve(process.cwd(), 'backend', '.env'),     // dev ts-node
    path.resolve(process.cwd(), '.env'),               // project root
    path.resolve(__dirname, '.env'),                   // compiled near server.js
    path.resolve(__dirname, '..', '.env'),             // compiled parent
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const res = dotenv.config({ path: p, override: false });
        if (res.parsed) break;
      }
    } catch {
      // ignore
    }
  }
})();

// ----- Security: ignore TELEGRAM_SESSION if present -----
if (process.env.TELEGRAM_SESSION) {
  console.warn('[SECURITY] TELEGRAM_SESSION env is set but will be IGNORED. ' +
               'Sessions are stored only in DB. Please remove TELEGRAM_SESSION from .env.');
}

const app = express();

// ----- CORS (adjust if needed) -----
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^http:\/\/localhost:5173$/i.test(origin)) return cb(null, true);
      if (/^http:\/\/127\.0\.0\.1:5173$/i.test(origin)) return cb(null, true);
      return cb(null, true); // allow during dev; tighten in prod
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ----- Routes -----
app.use('/api/telegram', telegramAuthRoutes); // /start, /confirm, /resend, /logout
app.use('/api', telegramSessionRoutes);       // /me (MTProto-based check)
app.use('/api', telegramHealthRoutes);        // /telegram/health (DB-only check)

// Optional rate limit per session (safe defaults)
app.use(
  '/api',
  rateLimitBySession({
    windowMs: 5000,
    max: 20,
    excludePaths: ['/api/telegram/health'],
  })
);

app.use('/api', telegramChatsRoutes);         // /telegram/chats
app.use('/api', telegramMessagesRoutes);      // /telegram/messages
app.use('/api', telegramSendRoutes);          // /telegram/send

// Debug endpoints
app.use('/', debugSessionsRoutes);

// Simple root
app.get('/', (_req, res) => res.send('Unified Messenger backend is up'));

// ----- HTTP + WS server -----
const port = Number(process.env.PORT || 7007);
const server = http.createServer(app);

// WebSocket server at /ws?sessionId=...
const wss = new WebSocketServer({ server, path: '/ws' });

// sessionId -> Set<WebSocket>
const subs = new Map<string, Set<WebSocket>>();
// sessionId -> listener
const bridges = new Map<string, (payload: any) => void>();
// WebSocket liveness (no custom properties on ws instance)
const alive = new WeakMap<WebSocket, boolean>();

// Heartbeat: ping/pong to drop dead connections
function heartbeat() {
  for (const set of subs.values()) {
    for (const ws of set) {
      const isAlive = alive.get(ws);
      if (isAlive === false) {
        try { ws.terminate(); } catch {}
        continue;
      }
      // Mark as not alive; will set back to true on 'pong'
      alive.set(ws, false);
      try { ws.ping(); } catch {}
    }
  }
}
setInterval(heartbeat, 30000).unref();

function parseCookie(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const [k, v] = pair.split('=');
    if (!k) return;
    out[k.trim()] = decodeURIComponent((v || '').trim());
  });
  return out;
}

/** Safely stringify payloads that may contain gramJS structures with cycles.
 *  - removes functions
 *  - removes 'client' property (common cycle root in NewMessage, etc.)
 *  - breaks other cycles with WeakSet
 *  - clamps output size to avoid flooding the wire
 */
function safeStringify(payload: any, limitBytes = 100_000): string {
  const seen = new WeakSet<object>();

  const replacer = (_key: string, value: any) => {
    if (typeof value === 'function') return undefined;
    if (value && typeof value === 'object') {
      // Remove 'client' property that closes the TelegramClient cycle
      if ('client' in value) {
        try {
          const shallow = Array.isArray(value) ? [...value] : { ...value };
          delete (shallow as any).client;
          value = shallow;
        } catch {
          // ignore
        }
      }
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };

  let s = JSON.stringify(payload, replacer);
  // Clamp huge messages to a compact placeholder
  if (s.length > limitBytes) {
    s = JSON.stringify({ type: 'raw', note: 'omitted large update', bytes: s.length });
  }
  return s;
}

wss.on('connection', (ws, req) => {
  // Extract sessionId from query or (legacy) from cookie
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  let sessionId = url.searchParams.get('sessionId') || '';
  if (!sessionId) {
    const cookies = parseCookie(req.headers.cookie);
    if (cookies.sessionId) sessionId = cookies.sessionId;
  }
  sessionId = String(sessionId || '').trim();

  if (!sessionId) {
    try { ws.close(1008, 'sessionId required'); } catch {}
    return;
  }

  // Track liveness using WeakMap
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  // Subscribe socket
  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  subs.get(sessionId)!.add(ws);

  // Ensure MTProto client for this session exists (will log if DB row missing)
  sessionManager.ensureClient(sessionId).catch((e) => {
    console.warn('[WebSocket] ensureClient failed:', e?.message || e);
  });

  // Bridge emitter -> this session's sockets (register once)
  if (!bridges.has(sessionId)) {
    const eventName = `update:${sessionId}`;
    const listener = (payload: any) => {
      // Prefer compact, known shape for our custom events; otherwise safely stringify whatever came
      let pack: string;
      try {
        // If payload already a plain object with type+data (DTO), this will serialize fast
        pack = safeStringify(payload);
      } catch {
        // Last resort: send a minimal stub so the bridge never crashes
        pack = JSON.stringify({ type: 'raw', note: 'failed to serialize update' });
      }

      const set = subs.get(sessionId);
      if (!set) return;
      for (const sock of set) {
        try { sock.send(pack); } catch {}
      }
    };
    sessionManager.on(eventName, listener);
    bridges.set(sessionId, listener);
  }

  ws.on('close', () => {
    const set = subs.get(sessionId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        subs.delete(sessionId);
        const bridge = bridges.get(sessionId);
        if (bridge) {
          sessionManager.off(`update:${sessionId}`, bridge);
          bridges.delete(sessionId);
        }
      }
    }
    alive.delete(ws);
  });

  ws.on('error', () => {
    try { ws.close(); } catch {}
  });
});

// ----- Start -----
server.listen(port, async () => {
  console.log('[Server] Server started on port', port);
  try {
    await sessionManager.restoreAll();
    console.log('[Server] All Telegram sessions restored');
  } catch (e) {
    console.error('[Server] Session restore failed:', e);
  }
});
