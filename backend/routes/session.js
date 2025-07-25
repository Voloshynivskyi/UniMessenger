// routes/session.js
const { Router } = require('express')
const { saveSession } = require('../services/sessionService')

const router = Router()

// POST /session/save
// Тіло: { sessionId: string, stringSession: string }
router.post('/save', (req, res) => {
  const { sessionId, stringSession } = req.body
  try {
    saveSession(sessionId, stringSession)
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
