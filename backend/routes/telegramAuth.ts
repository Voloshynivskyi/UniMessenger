// File: backend/routes/telegramAuth.ts
// Express route for Telegram authentication (login, logout, code, etc).

import express from 'express';
import cookieParser from 'cookie-parser';
import { sendCode, authenticate, resendCode, AuthResult } from '../services/telegramAuthService';

const router = express.Router();
router.use(cookieParser());

interface StartBody { phoneNumber: string; sessionId: string; }
interface AuthBody  { phoneNumber: string; sessionId: string; code: string; password?: string; }
interface ResendBody{ sessionId: string; }

// 1) Send code (idempotent while recent)
router.post('/start', async (req, res) => {
  try {
    const { phoneNumber, sessionId } = req.body as StartBody;
    if (!phoneNumber || !sessionId) return res.status(400).json({ error: 'phoneNumber and sessionId are required' });
    const phoneCodeHash = await sendCode(phoneNumber, sessionId);
    res.json({ phoneCodeHash });
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'sendCode failed' });
  }
});

// 2) Resend code (must use the same temp session)
router.post('/resend', async (req, res) => {
  try {
    const { sessionId } = req.body as ResendBody;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const phoneCodeHash = await resendCode(sessionId);
    res.json({ phoneCodeHash });
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'resendCode failed' });
  }
});

// 3) Confirm code (and 2FA if needed)
router.post('/auth', async (req, res) => {
  try {
    const { phoneNumber, sessionId, code, password } = req.body as AuthBody;
    if (!phoneNumber || !sessionId || !code) {
      return res.status(400).json({ error: 'phoneNumber, sessionId and code are required' });
    }
    const result: AuthResult = await authenticate(phoneNumber, sessionId, code, password);
    if (result.status === '2FA_REQUIRED') return res.status(401).json(result);

    res.cookie('sessionId', result.session!, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json(result);
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'auth failed' });
  }
});

// 4) Logout
router.post('/logout', (_req, res) => {
  res.clearCookie('sessionId');
  res.json({ success: true });
});

export default router;
