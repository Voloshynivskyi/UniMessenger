// services/telegramMessageService.js

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const debug = require('debug')('app:telegramMessages');

// Ініціалізація клієнта із збереженою сесією
function getClient(sessionString) {
  const client = new TelegramClient(
    new StringSession(sessionString),
    Number(process.env.API_ID),
    process.env.API_HASH,
    {
      connectionRetries: 5,
      useWSS: true,
    }
  );
  return client;
}

/**
 * Повертає останні N повідомлень із вказаного чату (chatId чи username)
 * @param {string} sessionString — рядок сесії, отриманий після авторизації
 * @param {string|number} peer — username (наприклад 'me' для Saved Messages) або ID чату
 * @param {number} limit — скільки повідомлень витягнути
 */
async function fetchMessages(sessionString, peer = 'me', limit = 10) {
  const client = getClient(sessionString);
  try {
    await client.connect();
    debug(`Fetching last ${limit} messages from ${peer}`);
    const messages = await client.getMessages(peer, { limit });
    return messages.map(msg => ({
      id: msg.id,
      date: msg.date,
      text: msg.message,
      from: msg.senderId || null
    }));
  } finally {
    await client.disconnect().catch(() => {});
  }
}

module.exports = { fetchMessages };
