import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Зберігатимемо активні клієнти у пам’яті, щоб не створювати нові під кожен запит
const telegramClients = new Map<string, TelegramClient>();

/**
 * Отримати клієнт Telegram за sessionId (і створити, якщо ще немає)
 */
async function getClientBySessionId(sessionId: string): Promise<TelegramClient> {
  // Якщо клієнт уже є в пам’яті — повертаємо
  if (telegramClients.has(sessionId)) {
    return telegramClients.get(sessionId)!;
  }

  // Дістаємо сесію з бази
  const session = await prisma.session.findUnique({
    where: { sessionId },
  });

  if (!session || !session.sessionString) {
    throw new Error('Session not found or not authorized');
  }

  const stringSession = new StringSession(session.sessionString);
  const client = new TelegramClient(
    stringSession,
    Number(process.env.API_ID),
    process.env.API_HASH || '',
    { connectionRetries: 5, useWSS: true }
  );

  await client.connect();
  telegramClients.set(sessionId, client);
  return client;
}

/**
 * Отримати список чатів з останнім повідомленням (прев’ю)
 */
export async function getChatPreviews(sessionId: string, limit = 20) {
  const client = await getClientBySessionId(sessionId);

  const dialogs = await client.getDialogs({ limit });

  return dialogs.map((dialog: any) => ({
    peerId: dialog.id.toString(),
    title: dialog.name || 'Без назви',
    peerType: dialog.entity?.className?.toLowerCase() || 'unknown',
    lastMessageText: dialog.message?.message || null,
    lastMessageAt: dialog.message?.date ? new Date(dialog.message.date * 1000) : null,
    unreadCount: dialog.unreadCount || 0,
    isPinned: dialog.pinned || false,
    photo: dialog.photo || null,
  }));
}
