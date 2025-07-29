// routes/telegramAuth.js

const express = require('express');
const router = express.Router();
const { sendCode, authenticate } = require('../services/telegramAuthService');

/**
 * POST /auth/telegram/start
 * Body: { phoneNumber, sessionId }
 */
router.post('/start', async (req, res) => {
  const { phoneNumber, sessionId } = req.body;
  if (!phoneNumber || !sessionId) {
    return res.status(400).json({ error: 'phoneNumber and sessionId are required' });
  }
  try {
    const phoneCodeHash = await sendCode(phoneNumber, sessionId);
    res.json({ phoneCodeHash });
  } catch (err) {
    console.error('sendCode error', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/telegram/auth
 * Body: { phoneNumber, code, sessionId, password? }
 */
router.post('/auth', async (req, res) => {
  const { phoneNumber, code, sessionId, password } = req.body;
  if (!phoneNumber || !code || !sessionId) {
    return res.status(400).json({ error: 'phoneNumber, code and sessionId are required' });
  }
  try {
    const result = await authenticate(phoneNumber, code, password, sessionId);
    if (result.status === '2FA_REQUIRED') {
      return res.status(401).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('authenticate error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
