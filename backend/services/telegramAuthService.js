// services/telegramAuthService.js

const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const debug = require('debug')('app:telegramAuth');

// In-memory session store (for production, use Redis або БД)
const sessions = new Map();

/**
 * Initialize or restore TelegramClient for a given sessionId.
 * Використовує WSS (порт 443) щоб уникнути TCPFull-проблем.
 */
function getClient(sessionId) {
  const saved = sessions.get(sessionId) || '';
  const sessionObj = new StringSession(saved);

  const client = new TelegramClient(
    sessionObj,
    Number(process.env.API_ID),
    process.env.API_HASH,
    {
      connectionRetries: 5,
      useWSS: true,
      testServers: false,
    }
  );

  client.persist = () => {
    sessions.set(sessionId, client.session.save());
    // TODO: також зберігати в Redis/БД
  };

  return client;
}

/**
 * Відправка коду на телефон.
 * Повертає phoneCodeHash.
 */
async function sendCode(phoneNumber, sessionId) {
  if (!process.env.API_ID || !process.env.API_HASH) {
    throw new Error('API_ID or API_HASH not set in .env');
  }
  const client = getClient(sessionId);
  try {
    debug(`Connecting for sendCode() session=${sessionId}`);
    await client.connect();

    debug(`Invoking auth.SendCode for ${phoneNumber}`);
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH,
        settings: new Api.CodeSettings({}),
      })
    );

    client.persist();
    debug(`SendCode result: ${JSON.stringify(result)}`);
    return result.phoneCodeHash;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/**
 * Повна авторизація одною функцією.
 * - phoneNumber + code
 * - необов’язково password (cloud password)
 * Якщо потрібен пароль — повертає { status: '2FA_REQUIRED' }.
 * Інакше — { status: 'AUTHORIZED', session }.
 */
async function authenticate(phoneNumber, code, password, sessionId) {
  const client = getClient(sessionId);
  try {
    debug(`Connecting for authenticate() session=${sessionId}`);
    await client.connect();

    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => code,
      password: password ? async () => password : undefined,
      onError: err => debug('authenticate error:', err)
    });

    client.persist();
    return { status: 'AUTHORIZED', session: client.session.save() };
  } catch (err) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { status: '2FA_REQUIRED' };
    }
    debug('authenticate error:', err);
    throw err;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

module.exports = { sendCode, authenticate };
