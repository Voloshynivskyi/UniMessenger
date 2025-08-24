// File: backend/server.ts
// Express backend server, sets up API routes and WebSocket gateway.

import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
const cookieParser = require('cookie-parser');

// Routes
import telegramAuthRoutes     from './routes/telegramAuth';
import telegramSessionRoutes  from './routes/telegramSession';
import telegramChatRoutes     from './routes/telegramChats';
import telegramMessagesRoutes from './routes/telegramMessages';
import telegramSendRoutes     from './routes/telegramSend';

// Middleware / services
import { rateLimitBySession } from './middleware/rateLimit';
import { restoreAllSessions } from './services/telegramAuthService';
import { sessionManager } from './services/sessionManager';

// 1) Load env
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();
const PORT = Number(process.env.PORT ?? 7007);

// Optional: silence Node's 10-listener warning globally for this emitter
// (root cause is fixed below; this is just a belt-and-suspenders)
sessionManager.setMaxListeners(0);

// 2) Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// 3) Health
app.get('/_health', (_req, res) => res.json({ ok: true }));

// 4) HTTP routes
app.use('/auth/telegram', telegramAuthRoutes);
app.use('/auth/telegram', telegramSessionRoutes);

app.use('/api',
  rateLimitBySession({
    windowMs: 5000,
    max: 20,
  })
);
app.use('/api', telegramChatRoutes);
app.use('/api', telegramMessagesRoutes);
app.use('/api', telegramSendRoutes);

app.get('/', (_req, res) => res.send('Backend is running'));

// 5) Start + restore sessions
const server = app.listen(PORT, async () => {
  console.log(`[Server] 🚀 Server started on port ${PORT}`);
  try { 
    await restoreAllSessions(); 
    console.log('[Server] All Telegram sessions restored');
  } catch (e) {
    console.error('[Server] Failed to restore sessions:', e);
  }
});

// ---------------------- WebSocket real-time gateway ----------------------
//
// Problem before:
// - We added one listener on sessionManager *per WebSocket connection*,
//   causing >10 listeners for a single "update:<sessionId>" event.
//
// Fix now:
// - Keep a single "bridge" listener per sessionId that broadcasts updates
//   to all active sockets of that session. Add/remove it when the first
//   socket joins / last socket leaves.

const wss = new WebSocketServer({ server, path: '/ws' });

// All active sockets per sessionId
const subs = new Map<string, Set<WebSocket>>();

// One broadcaster function per sessionId
const bridges = new Map<string, (payload: any) => void>();

const HEARTBEAT_MS = 30000;

function heartbeat() {
  for (const set of subs.values()) {
    for (const ws of set) {
      // @ts-ignore store custom flag
      if ((ws as any).isAlive === false) { try { ws.terminate(); } catch {} continue; }
      // @ts-ignore
      (ws as any).isAlive = false;
      try { ws.ping(); } catch {}
    }
  }
}
setInterval(heartbeat, HEARTBEAT_MS).unref();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || '';
  if (!sessionId) { 
    console.warn('[WebSocket] Connection rejected: sessionId required');
    ws.close(1008, 'sessionId required'); 
    return; 
  }

  console.log(`[WebSocket] Client connected for sessionId: ${sessionId}`);

  // Track liveness
  // @ts-ignore
  (ws as any).isAlive = true;
  ws.on('pong', () => { /* @ts-ignore */ (ws as any).isAlive = true; });

  // Join socket to subs map
  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  subs.get(sessionId)!.add(ws);

  // Ensure Telegram client is ready/wired
  sessionManager.ensureClient(sessionId).catch(() => {});

  // Lazy-register single bridge for this sessionId
  if (!bridges.has(sessionId)) {
    const eventName = `update:${sessionId}`;
    const bridge = (payload: any) => {
      const set = subs.get(sessionId);
      if (!set || set.size === 0) return;
      for (const sock of set) {
        try { sock.send(JSON.stringify(payload)); } catch {}
      }
    };
    bridges.set(sessionId, bridge);
    sessionManager.on(eventName, bridge);
  }

  // Cleanup on close
  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected for sessionId: ${sessionId}`);
    const set = subs.get(sessionId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        // No sockets left → remove the single bridge and maps
        subs.delete(sessionId);
        const bridge = bridges.get(sessionId);
        if (bridge) {
          sessionManager.off(`update:${sessionId}`, bridge);
          bridges.delete(sessionId);
        }
      }
    }
  });

  ws.on('error', () => { 
    console.error('[WebSocket] Error on connection');
    try { ws.close(); } catch {} 
  });
});
