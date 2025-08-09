import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
const cookieParser = require('cookie-parser');

import telegramAuthRoutes from './routes/telegramAuth';
import telegramSessionRoutes from './routes/telegramSession';
import telegramChatRoutes from './routes/telegramChats';
import { rateLimitBySession } from './middleware/rateLimit';
import { restoreAllSessions } from './services/telegramAuthService';

// Load env first (from backend/.env no matter where we run)
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();
const PORT = process.env.PORT ?? 7007;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Auth & session routes
app.use('/auth/telegram', telegramAuthRoutes);
app.use('/auth/telegram', telegramSessionRoutes);

// Chats API (rate limited)
app.use('/api', rateLimitBySession(3000), telegramChatRoutes);

app.get('/', (_req, res) => {
  res.send('Backend is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);

  // Try to restore sessions, but don't crash server on error
  (async () => {
    try {
      await restoreAllSessions();
    } catch (e) {
      console.error('[restoreAllSessions] failed:', e);
    }
  })();
});
