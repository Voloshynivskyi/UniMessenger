// backend/server.ts
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
const cookieParser = require('cookie-parser');

import telegramAuthRoutes from './routes/telegramAuth';
import telegramSessionRoutes from './routes/telegramSession';
import telegramChatRoutes from './routes/telegramChats';
import { rateLimitBySession } from './middleware/rateLimit';
import { restoreAllSessions } from './services/telegramAuthService';
import { sessionManager } from './services/sessionManager';

// 1) Load environment variables early (from backend/.env)
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();
const PORT = Number(process.env.PORT ?? 7007);

// 2) Common middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// 3) HTTP routes
app.use('/auth/telegram', telegramAuthRoutes);
app.use('/auth/telegram', telegramSessionRoutes);
app.use(
  '/api',
  rateLimitBySession({
    windowMs: 5000,   // 5 seconds window
    max: 10,          // up to 10 requests per 5s (per session+method+path)
    // Розкоментуй, щоб взагалі вимкнути ліміт саме для першого фетча прев'юшок:
    // excludePaths: ['/api/telegram/chats'],
    // debugEnvVar: 'RATE_LIMIT_DEBUG', // set to "1" in env to see logs
  })
);

app.use('/api', telegramChatRoutes);

// 4) Health-check
app.get('/', (_req, res) => res.send('Backend is running'));

// 5) Start HTTP server and restore long-lived Telegram clients
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  try {
    // Restore all saved sessions to keep users "online" after server restart
    await restoreAllSessions();
  } catch (e) {
    console.error('[restoreAllSessions] failed:', e);
  }
});

// ---------------------- WebSocket real-time gateway ----------------------

// 6) Create a WebSocket server bound to the same HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });

// 7) Map of sessionId -> Set<WebSocket> (list of subscribers per session)
const subs = new Map<string, Set<WebSocket>>();

// 8) Heartbeat (ping/pong) to drop dead sockets
const HEARTBEAT_MS = 30000;

function heartbeat() {
  for (const set of subs.values()) {
    for (const ws of set) {
      // @ts-ignore mark as not alive until pong arrives
      if ((ws as any).isAlive === false) {
        try { ws.terminate(); } catch {}
        continue;
      }
      // @ts-ignore set probe flag and ping
      (ws as any).isAlive = false;
      try { ws.ping(); } catch {}
    }
  }
}
setInterval(heartbeat, HEARTBEAT_MS).unref();

// 9) Handle new WebSocket connections
wss.on('connection', (ws, req) => {
  // Expect: ws://host/ws?sessionId=...
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || '';

  if (!sessionId) {
    ws.close(1008, 'sessionId required');
    return;
  }

  // Mark socket as alive; on pong we'll mark alive again
  // @ts-ignore
  (ws as any).isAlive = true;
  ws.on('pong', () => { /* @ts-ignore */ (ws as any).isAlive = true; });

  // Put this socket into subscription bucket for this sessionId
  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  subs.get(sessionId)!.add(ws);

  // Ensure a long-lived Telegram client exists (starts if not running)
  sessionManager.ensureClient(sessionId).catch(() => {});

  // Forward SessionManager updates (update:<sessionId>) to this socket
  const eventName = `update:${sessionId}`;
  const handler = (payload: any) => {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore send errors (socket might be closing)
    }
  };
  sessionManager.on(eventName, handler);

  // Clean up on socket close
  ws.on('close', () => {
    sessionManager.off(eventName, handler);
    subs.get(sessionId)?.delete(ws);
    if (!subs.get(sessionId)?.size) subs.delete(sessionId);
  });
});
