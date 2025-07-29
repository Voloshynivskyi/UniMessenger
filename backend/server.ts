// backend/server.ts
import path from 'path';
import dotenv from 'dotenv';

// Load .env from the same folder as this file (backend/.env)
dotenv.config({ path: path.resolve(__dirname, '.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
const telegramAuthRoutes = require('./routes/telegramAuth').default;

const app = express();
const PORT = process.env.PORT ?? 7007;

// DEBUG: ensure variables are loaded
console.log('Loaded API_ID =', process.env.API_ID);
console.log('Loaded API_HASH =', process.env.API_HASH?.slice(0, 5) + '…');

app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));

app.use('/auth/telegram', telegramAuthRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Backend is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
