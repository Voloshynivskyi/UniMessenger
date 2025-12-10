// backend/services/discord/discordService.ts
import discordClientManager from "./discordClientManager";
import { prisma } from "../../lib/prisma";
import { parseDiscordMessage } from "../../utils/discord/parseDiscordMessage";
import { getSocketGateway } from "../../realtime/socketGateway";
import { logger } from "../../utils/logger";

export class DiscordService {
  // INTERNAL: Safe account resolver
  private async resolveAccount(accountId: string) {
    const account = await prisma.discordAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      logger.warn(
        `[DiscordService] Account not found for accountId=${accountId}`
      );
      return null;
    }

    return account;
  }

  // Bootstrap — restore active accounts on server start
  async restoreActiveAccounts() {
    const accounts = await prisma.discordAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    logger.info(
      `[DiscordService] Restoring active Discord accounts: count=${accounts.length}`
    );

    for (const acc of accounts) {
      try {
        if (!discordClientManager.isClientActive(acc.id)) {
          await discordClientManager.attachAccount(acc.id, acc.botToken);
          logger.info(
            `[DiscordService] Restored Discord account id=${acc.id} userId=${acc.userId}`
          );
        } else {
          logger.info(
            `[DiscordService] Discord account already active id=${acc.id}`
          );
        }
      } catch (err) {
        logger.error(
          `[DiscordService] Failed to restore Discord account id=${acc.id}`,
          { err }
        );
      }
    }
  }

  // Attach / add bot account
  async addAccount(userId: string, botToken: string) {
    // 1. Check if bot already exists
    const existing = await prisma.discordAccount.findFirst({
      where: { botToken },
    });

    if (existing) {
      // Ensure isActive in DB
      if (!existing.isActive) {
        await prisma.discordAccount.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }

      // Ensure discord.js client is actually running in memory
      if (!discordClientManager.isClientActive(existing.id)) {
        await discordClientManager.attachAccount(
          existing.id,
          existing.botToken
        );
      }

      return existing;
    }

    // 2. If bot doesn't exist yet — create it
    const account = await prisma.discordAccount.create({
      data: {
        userId,
        botToken,
        isActive: true,
      },
    });

    await discordClientManager.attachAccount(account.id, botToken);

    return account;
  }

  // Remove bot (detach client + mark inactive)
  async removeAccount(accountId: string) {
    try {
      await discordClientManager.detachAccount(accountId);
    } catch (err) {
      logger.warn(
        `[DiscordService] detachAccount failed for accountId=${accountId}`,
        { err }
      );
    }

    await prisma.discordAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return { status: "ok" };
  }

  // Get accounts for current user
  async getAccounts(userId: string) {
    return prisma.discordAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Get dialogs (guilds + channels + threads)
  async getDialogs(accountId: string) {
    return discordClientManager.getDialogsTree(accountId);
  }

  // Get history for a channel / thread
  async getHistory(accountId: string, channelId: string, limit = 50) {
    const messages = await discordClientManager.fetchMessages(
      accountId,
      channelId,
      limit
    );

    return messages.map((msg) => parseDiscordMessage(msg, accountId));
  }

  // Send text message
  async sendMessage(accountId: string, channelId: string, text: string) {
    const sent = await discordClientManager.sendMessage(
      accountId,
      channelId,
      text
    );

    const parsed = parseDiscordMessage(sent, accountId);

    const account = await this.resolveAccount(accountId);

    if (account) {
      getSocketGateway().emitToUser(
        account.userId,
        "discord:message_confirmed",
        {
          platform: "discord",
          accountId,
          timestamp: new Date().toISOString(),
          chatId: parsed.chatId,
          parentChatId: parsed.parentChatId ?? null,
          tempId: parsed.messageId, // тимчасово = реальний id
          message: parsed,
        }
      );

      logger.info(
        `[DiscordService] message_confirmed → user=${account.userId} chat=${parsed.chatId} msg=${parsed.messageId}`
      );
    }

    return parsed;
  }

  // Send file with optional caption
  async sendFile(
    accountId: string,
    channelId: string,
    fileBuf: Buffer,
    fileName: string,
    caption?: string
  ) {
    const sent = await discordClientManager.sendFile(
      accountId,
      channelId,
      fileBuf,
      fileName,
      caption
    );

    const parsed = parseDiscordMessage(sent, accountId);

    const account = await this.resolveAccount(accountId);

    if (account) {
      getSocketGateway().emitToUser(
        account.userId,
        "discord:message_confirmed",
        {
          platform: "discord",
          accountId,
          timestamp: new Date().toISOString(),
          chatId: parsed.chatId,
          parentChatId: parsed.parentChatId ?? null,
          tempId: parsed.messageId,
          message: parsed,
        }
      );

      logger.info(
        `[DiscordService] file_confirmed → user=${account.userId} chat=${parsed.chatId} msg=${parsed.messageId}`
      );
    }

    return parsed;
  }
}

export const discordService = new DiscordService();
