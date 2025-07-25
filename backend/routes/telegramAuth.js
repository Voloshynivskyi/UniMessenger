// routes/telegramAuth.js
const { Router } = require('express')
const {
  sendCode,
  signInWithCode,
  send2FA,
} = require('../services/telegramAuthService')

const router = Router()

// Надіслати код
router.post('/start', async (req, res) => {
  console.log('BODY /start:', req.body)  // додано для дебагу
  const { phoneNumber, sessionId } = req.body
  try {
    const phoneCodeHash = await sendCode(phoneNumber, sessionId)
    res.json({ phoneCodeHash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Верифікувати код
router.post('/verify', async (req, res) => {
  console.log('BODY /verify:', req.body)  // додано для дебагу
  const { phoneNumber, code, phoneCodeHash, sessionId } = req.body
  try {
    const result = await signInWithCode(phoneNumber, code, phoneCodeHash, sessionId)
    if (result === '2FA_REQUIRED') {
      res.status(403).json({ error: '2FA_REQUIRED' })
    } else {
      res.json({ stringSession: result })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Ввести 2FA
router.post('/2fa', async (req, res) => {
  console.log('BODY /2fa:', req.body)  // додано для дебагу
  const { password, sessionId } = req.body
  try {
    const session = await send2FA(password, sessionId)
    res.json({ stringSession: session })
  } catch (err) {
    res.status(401).json({ error: err.message })
  }
})

module.exports = router
