// backend/services/discord/discordService.ts

import { prisma } from "../../lib/prisma";
import { discordClientManager } from "./discordClientManager";
import { parseDiscordMessage } from "../../utils/discord/parseDiscordMessage";
import { getSocketGateway } from "../../realtime/socketGateway";
import { logger } from "../../utils/logger";

// DISCORD SERVICE - BOT ONLY
// - bot registration (store token)
// - initialize discord.js client
// - update guilds list
// - dialogs tree: bot → guilds → channels/threads
// - chat history
// - send / file / edit / delete

export class DiscordService {
  /* ------------------------------------------------------------
   * 0) INTERNAL: ensure bot client is attached
   * ------------------------------------------------------------ */
  private async ensureBotClient(botId: string) {
    if (discordClientManager.isBotReady(botId)) {
      return;
    }

    const bot = await prisma.discordBot.findUnique({ where: { id: botId } });
    if (!bot || !bot.isActive) {
      throw new Error("Bot not found or inactive");
    }

    await discordClientManager.attachBot(botId, bot.botToken);
  }

  /* ------------------------------------------------------------
   * 1) Register bot (user pastes botToken)
   * ------------------------------------------------------------ */
  async registerUserBot(userId: string, botToken: string) {
    // створюємо запис бота
    const bot = await prisma.discordBot.create({
      data: {
        userId,
        botToken,
        isActive: true,
      },
    });

    // attach discord.js client
    const client = await discordClientManager.attachBot(bot.id, botToken);

    // запам’ятати botUserId / username
    const updated = await prisma.discordBot.update({
      where: { id: bot.id },
      data: {
        botUserId: client.user?.id ?? null,
        botUsername: client.user?.username ?? null,
      },
    });

    // оновити список гільдій
    await this.refreshBotGuilds(bot.id);

    return updated;
  }

  /* ------------------------------------------------------------
   * 2) List bots for user
   * ------------------------------------------------------------ */
  async listUserBots(userId: string) {
    return prisma.discordBot.findMany({
      where: { userId, isActive: true },
      include: { guilds: true },
    });
  }

  /* ------------------------------------------------------------
   * 3) Deactivate / delete bot
   * ------------------------------------------------------------ */
  async deactivateBot(userId: string, botId: string) {
    const bot = await prisma.discordBot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      throw new Error("Bot not found");
    }

    await prisma.discordBot.update({
      where: { id: botId },
      data: { isActive: false },
    });

    await discordClientManager.detachBot(botId);
  }

  // 4) BOT GUILDS - refresh server list
  async refreshBotGuilds(botId: string) {
    await this.ensureBotClient(botId);
    const client = discordClientManager.getClient(botId);

    if (!client) throw new Error("Bot client not found");

    const guilds = [...client.guilds.cache.values()];

    await prisma.discordBotGuild.deleteMany({ where: { botId } });

    for (const g of guilds) {
      await prisma.discordBotGuild.create({
        data: {
          botId,
          guildId: g.id,
          name: g.name,
          icon: g.icon ?? null,
        },
      });
    }

    return guilds.length;
  }

  /* ------------------------------------------------------------
   * 5) DIALOGS TREE — FOR ALL BOTS OF USER
   * ------------------------------------------------------------ */
  async getDialogsForUser(userId: string) {
    const bots = await prisma.discordBot.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const dialogs: any[] = [];

    for (const bot of bots) {
      await this.ensureBotClient(bot.id);

      const tree = await discordClientManager.getDialogsTree(bot.id);

      dialogs.push({
        botId: bot.id,
        botUserId: bot.botUserId,
        botUsername: bot.botUsername,
        guilds: tree,
      });
    }

    return dialogs;
  }

  /* ------------------------------------------------------------
   * 6) HISTORY (per bot, per chat)
   * ------------------------------------------------------------ */
  async getHistory(botId: string, chatId: string, limit = 50) {
    await this.ensureBotClient(botId);

    const client = discordClientManager.getClient(botId);
    const botUserId = client?.user?.id ?? null;

    const msgs = await discordClientManager.fetchMessages(botId, chatId, limit);

    return msgs.map((msg) =>
      parseDiscordMessage({
        message: msg,
        accountId: botId,
        guildId: msg.guild?.id ?? "",
        channelId: chatId,
        botUserId,
      })
    );
  }

  /* ------------------------------------------------------------
   * 7) SEND MESSAGE
   * ------------------------------------------------------------ */
  async sendMessage(
    botId: string,
    chatId: string,
    text: string,
    userId: string
  ) {
    await this.ensureBotClient(botId);

    const sent = await discordClientManager.sendMessage(botId, chatId, text);

    const client = discordClientManager.getClient(botId);
    const botUserId = client?.user?.id ?? null;

    const parsed = parseDiscordMessage({
      message: sent,
      accountId: botId,
      guildId: sent.guild?.id ?? "",
      channelId: chatId,
      botUserId,
    });

    getSocketGateway().emitToUser(userId, "discord:message_confirmed", {
      platform: "discord",
      accountId: botId,
      chatId,
      message: parsed,
    });

    return parsed;
  }

  /* ------------------------------------------------------------
   * 8) SEND FILE
   * ------------------------------------------------------------ */
  async sendFile(
    botId: string,
    chatId: string,
    file: Buffer,
    originalName: string,
    caption: string | undefined,
    userId: string
  ) {
    await this.ensureBotClient(botId);

    const sent = await discordClientManager.sendFile(
      botId,
      chatId,
      file,
      originalName,
      caption
    );

    const client = discordClientManager.getClient(botId);
    const botUserId = client?.user?.id ?? null;

    const parsed = parseDiscordMessage({
      message: sent,
      accountId: botId,
      guildId: sent.guild?.id ?? "",
      channelId: chatId,
      botUserId,
    });

    getSocketGateway().emitToUser(userId, "discord:message_confirmed", {
      platform: "discord",
      accountId: botId,
      chatId,
      message: parsed,
    });

    return parsed;
  }

  /* ------------------------------------------------------------
   * 9) EDIT MESSAGE
   * ------------------------------------------------------------ */
  async editMessage(
    botId: string,
    chatId: string,
    messageId: string,
    text: string,
    userId: string
  ) {
    await this.ensureBotClient(botId);

    const edited = await discordClientManager.editMessage(
      botId,
      chatId,
      messageId,
      text
    );

    const client = discordClientManager.getClient(botId);
    const botUserId = client?.user?.id ?? null;

    const parsed = parseDiscordMessage({
      message: edited,
      accountId: botId,
      guildId: edited.guild?.id ?? "",
      channelId: chatId,
      botUserId,
    });

    // окремого confirm можна не надсилати, бо прийде message_edited з gateway
    getSocketGateway().emitToUser(userId, "discord:message_edited_confirmed", {
      platform: "discord",
      accountId: botId,
      chatId,
      message: parsed,
    });

    return parsed;
  }

  /* ------------------------------------------------------------
   * 10) DELETE MESSAGE
   * ------------------------------------------------------------ */
  async deleteMessage(
    botId: string,
    chatId: string,
    messageId: string,
    userId: string
  ) {
    await this.ensureBotClient(botId);

    await discordClientManager.deleteMessage(botId, chatId, messageId);

    // Gateway will send discord:message_deleted anyway,
    // but we can confirm immediately
    getSocketGateway().emitToUser(userId, "discord:message_deleted_confirmed", {
      platform: "discord",
      accountId: botId,
      chatId,
      messageIds: [messageId],
    });

    return { ok: true };
  }
}

export const discordService = new DiscordService();
