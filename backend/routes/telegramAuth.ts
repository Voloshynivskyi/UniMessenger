// backend/routes/telegramAuth.ts
import * as express from 'express';
import { sendCode, authenticate, AuthResult } from '../services/telegramAuthService';

const router = express.Router();

interface StartBody {
  phoneNumber: string;
  sessionId: string;
}

interface AuthBody {
  phoneNumber: string;
  code: string;
  sessionId: string;
  password?: string;
}

router.post('/start', async (req: express.Request<{}, {}, StartBody>, res) => {
  const { phoneNumber, sessionId } = req.body;
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

router.post('/auth', async (req: express.Request<{}, {}, AuthBody>, res) => {
  const { phoneNumber, code, sessionId, password } = req.body;
  if (!phoneNumber || !code || !sessionId) {
    return res.status(400).json({ error: 'phoneNumber, code and sessionId are required' });
  }
  try {
    const result: AuthResult = await authenticate(phoneNumber, code, password, sessionId);
    if (result.status === '2FA_REQUIRED') {
      return res.status(401).json(result);
    }
    // тепер повертаємо також username
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
