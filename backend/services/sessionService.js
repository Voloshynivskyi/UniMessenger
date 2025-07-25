// services/sessionService.js

// Тимчасове зберігання сесій у пам'яті
const sessions = new Map()

/**
 * Зберегти stringSession під заданим sessionId
 * @param {string} sessionId
 * @param {string} stringSession
 */
function saveSession(sessionId, stringSession) {
  if (!sessionId || !stringSession) {
    throw new Error('sessionId і stringSession є обов’язковими')
  }
  sessions.set(sessionId, stringSession)
}

/**
 * Отримати stringSession за sessionId
 * @param {string} sessionId
 * @returns {string|null}
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null
}

module.exports = {
  saveSession,
  getSession,
}
