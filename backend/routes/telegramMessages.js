// routes/telegramMessages.js

const express = require('express');
const router = express.Router();
const { fetchMessages } = require('../services/telegramMessageService');

/**
 * POST /telegram/messages
 * Body: { session, peer?, limit? }
 */
router.post('/messages', async (req, res) => {
  const { session, peer = 'me', limit = 10 } = req.body;
  if (!session) {
    return res.status(400).json({ error: 'session is required' });
  }
  try {
    const msgs = await fetchMessages(session, peer, limit);
    res.json({ messages: msgs });
  } catch (err) {
    console.error('fetchMessages error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
