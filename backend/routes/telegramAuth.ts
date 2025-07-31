import express from 'express';
import cookieParser from 'cookie-parser';
import { sendCode, authenticate, AuthResult } from '../services/telegramAuthService';

const router = express.Router();
router.use(cookieParser());

interface StartBody {
  phoneNumber: string;
  sessionId: string;
}

interface AuthBody {
  phoneNumber: string;
  sessionId: string;
  code: string;
  password?: string;
}

// 1) Надіслати код
router.post('/start', async (req, res) => {
  const { phoneNumber, sessionId } = req.body as StartBody;
  if (!phoneNumber || !sessionId) {
    return res.status(400).json({ error: 'phoneNumber and sessionId are required' });
  }
  try {
    const phoneCodeHash = await sendCode(phoneNumber, sessionId);
    res.json({ phoneCodeHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2) Підтвердити код
router.post('/auth', async (req, res) => {
  const { phoneNumber, sessionId, code, password } = req.body as AuthBody;
  if (!phoneNumber || !sessionId || !code) {
    return res.status(400).json({ error: 'phoneNumber, sessionId and code are required' });
  }
  try {
    const result: AuthResult = await authenticate(phoneNumber, sessionId, code, password);
    if (result.status === '2FA_REQUIRED') {
      return res.status(401).json(result);
    }
    // Встановлюємо HTTP-only cookie
    res.cookie('sessionId', result.session!, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3) Logout
router.post('/logout', (_req, res) => {
  res.clearCookie('sessionId');
  res.json({ success: true });
});

export default router;
