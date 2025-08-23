// backend/server.ts
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
const cookieParser = require('cookie-parser');

// Routes
import telegramAuthRoutes    from './routes/telegramAuth';
import telegramSessionRoutes from './routes/telegramSession';
import telegramChatRoutes    from './routes/telegramChats';
import telegramMessagesRoutes from './routes/telegramMessages';

// Middleware / services
import { rateLimitBySession } from './middleware/rateLimit';
import { restoreAllSessions } from './services/telegramAuthService';
import { sessionManager } from './services/sessionManager';

// Load .env from backend folder
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();
const PORT = Number(process.env.PORT ?? 7007);

// Basic middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Health
app.get('/_health', (_req, res) => res.json({ ok: true }));

// Auth routes
app.use('/auth/telegram', telegramAuthRoutes);
app.use('/auth/telegram', telegramSessionRoutes);

// API routes (mounted EXACTLY under /api)
app.use(
  '/api',
  rateLimitBySession({
    windowMs: 5000,
    max: 20,
  })
);

// Mount chats and messages under /api
app.use('/api', telegramChatRoutes);
app.use('/api', telegramMessagesRoutes);

// Root
app.get('/', (_req, res) => res.send('Backend is running'));

// Start server and restore sessions
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  try { await restoreAllSessions(); } catch (e) {
    console.error('[restoreAllSessions] failed:', e);
  }
});

// ---------------------- WebSocket gateway ----------------------
const wss = new WebSocketServer({ server, path: '/ws' });
const subs = new Map<string, Set<WebSocket>>();
const HEARTBEAT_MS = 30000;

function heartbeat() {
  for (const set of subs.values()) {
    for (const ws of set) {
      // @ts-ignore
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
  if (!sessionId) { ws.close(1008, 'sessionId required'); return; }

  // @ts-ignore
  (ws as any).isAlive = true;
  ws.on('pong', () => { /* @ts-ignore */ (ws as any).isAlive = true; });

  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  subs.get(sessionId)!.add(ws);

  // ensure client wiring
  sessionManager.ensureClient(sessionId).catch(() => {});

  const eventName = `update:${sessionId}`;
  const handler = (payload: any) => { try { ws.send(JSON.stringify(payload)); } catch {} };
  sessionManager.on(eventName, handler);

  ws.on('close', () => {
    sessionManager.off(eventName, handler);
    subs.get(sessionId)?.delete(ws);
    if (!subs.get(sessionId)?.size) subs.delete(sessionId);
  });
});
