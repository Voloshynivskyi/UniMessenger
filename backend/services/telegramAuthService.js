// backend/services/telegramAuthService.js
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const { TelegramClient } = require('telegram')
const { StringSession }   = require('telegram/sessions')
const Api                  = require('telegram/tl/api')

// Тимчасове зберігання сесій
const sessions = new Map()

function createClient(sessionId) {
  const stringSession = sessions.get(sessionId) || new StringSession('')
  return new TelegramClient(stringSession, Number(process.env.API_ID), process.env.API_HASH, {
    connectionRetries: 5,
    // Додамо обробник помилок, щоб onError не був undefined
    onError: (err) => console.error('TelegramClient error:', err),
  })
}

async function sendCode(phoneNumber, sessionId) {
  const client = createClient(sessionId)
  await client.connect()
  const result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber,
      apiId:   Number(process.env.API_ID),
      apiHash: process.env.API_HASH,
      settings: new Api.CodeSettings({}) // зазвичай можна залишити дефолт
    })
  )
  sessions.set(sessionId, client.session)
  return result.phoneCodeHash
}

async function signInWithCode(phoneNumber, code, phoneCodeHash, sessionId) {
  const client = createClient(sessionId)
  await client.connect()
  try {
    await client.invoke(
      new Api.auth.SignIn({ phoneNumber, phoneCodeHash, phoneCode: code })
    )
    const sessionString = client.session.save()
    sessions.set(sessionId, client.session)
    return sessionString
  } catch (err) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return '2FA_REQUIRED'
    }
    throw err
  }
}

async function send2FA(password, sessionId) {
  const client = createClient(sessionId)
  await client.connect()
  try {
    // Використовуємо SRP-перевірку пароля
    const passwordInfo = await client.invoke(new Api.account.GetPassword())
    const { currentSalt, srp_B } = passwordInfo
    const { A, M1 } = await client.computeCheckPassword({ password, currentSalt, srp_B })
    await client.invoke(new Api.auth.CheckPassword({ password: A, srpId: passwordInfo.srp_id, srpB: srp_B, srpM1: M1 }))
    const sessionString = client.session.save()
    sessions.set(sessionId, client.session)
    return sessionString
  } catch (err) {
    throw err
  }
}

module.exports = {
  sendCode,
  signInWithCode,
  send2FA,
}
