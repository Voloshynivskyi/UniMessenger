// File: backend/services/telegramChatService.ts
// Service functions for fetching Telegram chat previews.

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store active clients in memory to avoid creating new ones for each request
const telegramClients = new Map<string, TelegramClient>();

/**
 * Get Telegram client by sessionId (create if not exists)
 */
async function getClientBySessionId(sessionId: string): Promise<TelegramClient> {
  if (telegramClients.has(sessionId)) {
    return telegramClients.get(sessionId)!;
  }

  // Get session from database
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
 * Get list of chats with last message preview
 */
export async function getChatPreviews(sessionId: string, limit = 20) {
  const client = await getClientBySessionId(sessionId);

  const dialogs = await client.getDialogs({ limit });

  return dialogs.map((dialog: any) => ({
    peerId: dialog.id.toString(),
    title: dialog.name || 'Untitled',
    peerType: dialog.entity?.className?.toLowerCase() || 'unknown',
    lastMessageText: dialog.message?.message || null,
    lastMessageAt: dialog.message?.date ? new Date(dialog.message.date * 1000) : null,
    unreadCount: dialog.unreadCount || 0,
    isPinned: dialog.pinned || false,
    photo: dialog.photo || null,
  }));
}

