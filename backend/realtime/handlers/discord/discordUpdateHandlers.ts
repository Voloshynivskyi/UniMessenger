// backend/realtime/handlers/discord/discordUpdateHandlers.ts

import { getSocketGateway } from "../../socketGateway";
import { parseDiscordMessage } from "../../../utils/discord/parseDiscordMessage";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../utils/logger";

/* ============================================================
   INTERNAL HELPERS
============================================================ */

async function resolveBot(botId: string) {
  const bot = await prisma.discordBot.findUnique({
    where: { id: botId },
  });

  if (!bot) {
    logger.warn(`[DiscordRealtime] Bot not found: ${botId}`);
    return null;
  }

  return bot;
}

/* ============================================================
   NEW MESSAGE
============================================================ */

export async function emitDiscordNewMessage(p: {
  accountId: string; // botId
  guildId: string;
  channelId: string; // may be thread
  message: any;
  botUserId?: string | null;
}) {
  const { accountId: botId, guildId, channelId, message, botUserId } = p;

  const bot = await resolveBot(botId);
  if (!bot) return;

  const parsed = parseDiscordMessage({
    message,
    accountId: botId,
    guildId,
    channelId,
    botUserId: botUserId ?? null,
  });

  logger.info(
    `[DiscordRealtime] NEW → user=${bot.userId} guild=${guildId} channel=${channelId} msg=${parsed.messageId}`
  );

  getSocketGateway().emitToUser(bot.userId, "discord:new_message", {
    platform: "discord",
    accountId: botId,
    chatId: parsed.chatId, // unified
    timestamp: new Date().toISOString(),
    message: parsed,
  });
}

/* ============================================================
   EDITED MESSAGE
============================================================ */

export async function emitDiscordEditedMessage(p: {
  accountId: string;
  guildId: string;
  channelId: string;
  message: any;
  botUserId?: string | null;
}) {
  const { accountId: botId, guildId, channelId, message, botUserId } = p;

  const bot = await resolveBot(botId);
  if (!bot) return;

  const parsed = parseDiscordMessage({
    message,
    accountId: botId,
    guildId,
    channelId,
    botUserId: botUserId ?? null,
  });

  logger.info(
    `[DiscordRealtime] EDIT → user=${bot.userId} guild=${guildId} channel=${channelId} msg=${parsed.messageId}`
  );

  getSocketGateway().emitToUser(bot.userId, "discord:message_edited", {
    platform: "discord",
    accountId: botId,
    chatId: parsed.chatId,
    messageId: parsed.messageId,
    newText: parsed.text ?? null,
    updated: parsed,
    timestamp: new Date().toISOString(),
  });
}

/* ============================================================
   DELETED MESSAGE
============================================================ */

export async function emitDiscordDeletedMessage(p: {
  accountId: string;
  guildId: string;
  channelId: string;
  messageId: string;
}) {
  const { accountId: botId, guildId, channelId, messageId } = p;

  const bot = await resolveBot(botId);
  if (!bot) return;

  logger.info(
    `[DiscordRealtime] DELETE → user=${bot.userId} guild=${guildId} channel=${channelId} msg=${messageId}`
  );

  getSocketGateway().emitToUser(bot.userId, "discord:message_deleted", {
    platform: "discord",
    accountId: botId,
    chatId: channelId, // для delete ми не знаємо, чи це thread → фронт map'ить сам
    messageIds: [messageId],
    timestamp: new Date().toISOString(),
  });
}

/* ============================================================
   TYPING
============================================================ */

export async function emitDiscordTyping(p: {
  accountId: string;
  guildId: string;
  channelId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}) {
  const {
    accountId: botId,
    guildId,
    channelId,
    userId,
    username,
    isTyping,
  } = p;

  const bot = await resolveBot(botId);
  if (!bot) return;

  logger.info(
    `[DiscordRealtime] TYPING → user=${bot.userId} guild=${guildId} channel=${channelId} by=${username}`
  );

  getSocketGateway().emitToUser(bot.userId, "discord:typing", {
    platform: "discord",
    accountId: botId,
    chatId: channelId,
    userId,
    username,
    isTyping,
    timestamp: new Date().toISOString(),
  });
}
