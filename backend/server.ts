// backend/server.ts — Express setup with cookie-parser

import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
// use require to avoid missing type declarations error
const cookieParser = require('cookie-parser');

import telegramAuthRoutes from './routes/telegramAuth';
import telegramSessionRoutes from './routes/telegramSession';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT ?? 7007;

app.use(express.json());
app.use(cookieParser()); // Parse HTTP-only cookies
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,     // Allow sending/receiving cookies
}));

app.use('/auth/telegram', telegramAuthRoutes);      // Login routes
app.use('/auth/telegram', telegramSessionRoutes);   // Session check routes

app.get('/', (_req, res) => {
  res.send('Backend is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
