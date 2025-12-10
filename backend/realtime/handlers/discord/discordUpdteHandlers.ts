// backend/realtime/handlers/discord/discordUpdteHandlers.ts
import { getSocketGateway } from "../../socketGateway";
import { parseDiscordMessage } from "../../../utils/discord/parseDiscordMessage";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../utils/logger";

// INTERNAL: Resolve account only once
async function resolveAccount(accountId: string) {
  const account = await prisma.discordAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    logger.warn(
      `[DiscordRealtime] Account not found for accountId=${accountId}`
    );
    return null;
  }

  return account;
}

// NEW MESSAGE
export async function emitDiscordNewMessage(
  accountId: string,
  rawMessage: any
) {
  const account = await resolveAccount(accountId);
  if (!account) return;

  const parsed = parseDiscordMessage(rawMessage, accountId);

  const payload = {
    platform: "discord" as const,
    accountId,
    timestamp: new Date().toISOString(),
    message: parsed,
  };

  logger.info(
    `[DiscordRealtime] NEW message → user=${account.userId} chat=${parsed.chatId} msg=${parsed.messageId}`
  );

  getSocketGateway().emitToUser(account.userId, "discord:new_message", payload);
}

// EDITED MESSAGE
export async function emitDiscordEditedMessage(
  accountId: string,
  rawMessage: any
) {
  const account = await resolveAccount(accountId);
  if (!account) return;

  const parsed = parseDiscordMessage(rawMessage, accountId);

  const payload = {
    platform: "discord" as const,
    accountId,
    timestamp: new Date().toISOString(),
    chatId: parsed.chatId,
    messageId: parsed.messageId,
    updated: parsed,
  };

  logger.info(
    `[DiscordRealtime] EDIT message → user=${account.userId} chat=${parsed.chatId} msg=${parsed.messageId}`
  );

  getSocketGateway().emitToUser(
    account.userId,
    "discord:message_edited",
    payload
  );
}

// DELETED MESSAGE
export async function emitDiscordDeletedMessage(
  accountId: string,
  channelId: string,
  messageId: string
) {
  const account = await resolveAccount(accountId);
  if (!account) return;

  const payload = {
    platform: "discord" as const,
    accountId,
    timestamp: new Date().toISOString(),
    chatId: channelId,
    messageIds: [messageId],
  };

  logger.info(
    `[DiscordRealtime] DELETE message → user=${account.userId} chat=${channelId} msg=${messageId}`
  );

  getSocketGateway().emitToUser(
    account.userId,
    "discord:message_deleted",
    payload
  );
}

// TYPING
export async function emitDiscordTyping(
  accountId: string,
  chatId: string,
  userId: string,
  username: string,
  isTyping: boolean
) {
  const account = await resolveAccount(accountId);
  if (!account) return;

  const payload = {
    platform: "discord" as const,
    accountId,
    timestamp: new Date().toISOString(),
    chatId,
    userId,
    username,
    isTyping,
  };

  logger.info(
    `[DiscordRealtime] TYPING → user=${account.userId} chat=${chatId} by=${username}`
  );

  getSocketGateway().emitToUser(account.userId, "discord:typing", payload);
}
