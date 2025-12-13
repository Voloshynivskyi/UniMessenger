// backend/services/discord/discordClientManager.ts

import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ForumChannel,
  Message,
  type TextBasedChannel,
  type PartialMessage,
  type Typing,
  Collection,
} from "discord.js";

import {
  emitDiscordNewMessage,
  emitDiscordEditedMessage,
  emitDiscordDeletedMessage,
  emitDiscordTyping,
} from "../../realtime/handlers/discord/discordUpdateHandlers";

import { logger } from "../../utils/logger";

/* ============================================================
   TYPES
============================================================ */

interface DiscordBotRuntime {
  client: Client;
  token: string;

  botUserId: string | null;
  botUsername: string | null;

  guilds: Map<string, string>;
  channels: Map<string, TextChannel | NewsChannel | ForumChannel>;
  threads: Map<string, ThreadChannel>;
}

/* ============================================================
   TYPE GUARDS
============================================================ */

function isForumChannel(ch: any): ch is ForumChannel {
  return ch?.type === ChannelType.GuildForum;
}

function isTextChannel(ch: any): ch is TextChannel | NewsChannel {
  return (
    ch?.type === ChannelType.GuildText ||
    ch?.type === ChannelType.GuildAnnouncement
  );
}

function isThreadChannel(ch: any): ch is ThreadChannel {
  return (
    ch?.type === ChannelType.PublicThread ||
    ch?.type === ChannelType.PrivateThread ||
    ch?.type === ChannelType.AnnouncementThread
  );
}

function isSendableChannel(
  ch: any
): ch is TextChannel | NewsChannel | ThreadChannel {
  return isTextChannel(ch) || isThreadChannel(ch);
}

/* ============================================================
   MULTI-BOT CLIENT MANAGER
============================================================ */

export class DiscordClientManager {
  // KEY = DiscordBot.id (з Prisma)
  private bots: Map<string, DiscordBotRuntime> = new Map();

  /* ------------------------------------------------------------
     ATTACH BOT INSTANCE
  ------------------------------------------------------------ */

  public async attachBot(botId: string, botToken: string) {
    if (this.bots.has(botId)) {
      logger.info(
        `[DiscordClientManager] Bot already attached for id=${botId}`
      );
      return this.bots.get(botId)!.client;
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageTyping,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.User],
    });

    const runtime: DiscordBotRuntime = {
      client,
      token: botToken,
      botUserId: null,
      botUsername: null,
      guilds: new Map(),
      channels: new Map(),
      threads: new Map(),
    };

    this.registerEvents(botId, runtime);

    logger.info(`[DiscordClientManager] Logging in bot ${botId}...`);
    await client.login(botToken);

    runtime.botUserId = client.user?.id ?? null;
    runtime.botUsername = client.user?.username ?? null;

    logger.info(
      `[DiscordClientManager] Bot ${botId} logged in as ${client.user?.tag}`
    );

    await this.preloadStructures(runtime);

    this.bots.set(botId, runtime);
    return client;
  }

  /* ------------------------------------------------------------
     DETACH BOT
  ------------------------------------------------------------ */

  public async detachBot(botId: string) {
    const bot = this.bots.get(botId);
    if (!bot) return;

    logger.info(`[DiscordClientManager] Destroying bot ${botId}`);
    await bot.client.destroy();
    this.bots.delete(botId);
  }

  /* ------------------------------------------------------------
     HELPERS
  ------------------------------------------------------------ */

  public isBotReady(botId: string): boolean {
    return this.bots.has(botId);
  }

  public getClient(botId: string): Client | null {
    return this.bots.get(botId)?.client ?? null;
  }

  public getBotMeta(
    botId: string
  ): { botUserId: string | null; botUsername: string | null } | null {
    const inst = this.bots.get(botId);
    if (!inst) return null;
    return {
      botUserId: inst.botUserId,
      botUsername: inst.botUsername,
    };
  }

  /* ------------------------------------------------------------
     PRELOAD STRUCTURES
  ------------------------------------------------------------ */

  private async preloadStructures(inst: DiscordBotRuntime) {
    logger.info("[DiscordClientManager] preload START");

    const c = inst.client;

    for (const [, guild] of c.guilds.cache) {
      inst.guilds.set(guild.id, guild.name);

      const channels = await guild.channels.fetch();

      for (const ch of channels.values()) {
        if (!ch) continue;

        if (isTextChannel(ch) || isForumChannel(ch)) {
          inst.channels.set(ch.id, ch);
        }

        // threads під текстовими каналами та форумами
        if (isTextChannel(ch) || isForumChannel(ch)) {
          try {
            const active = await ch.threads.fetchActive();
            active.threads.forEach((t) => inst.threads.set(t.id, t));

            const archived = await ch.threads.fetchArchived();
            archived.threads.forEach((t) => inst.threads.set(t.id, t));
          } catch (err) {
            logger.warn("[DiscordClientManager] threads preload failed", {
              guildId: guild.id,
              channelId: ch.id,
              err,
            });
          }
        }
      }
    }

    logger.info(
      `[DiscordClientManager] preload DONE: guilds=${inst.guilds.size} channels=${inst.channels.size} threads=${inst.threads.size}`
    );
  }

  /* ------------------------------------------------------------
     EVENT HANDLERS FOR EACH BOT SEPARATELY
  ------------------------------------------------------------ */

  private registerEvents(botId: string, inst: DiscordBotRuntime) {
    const client = inst.client;

    client.on("ready", () => {
      logger.info(
        `[DiscordClientManager] Bot READY (${botId}) as ${client.user?.tag}`
      );
    });

    client.on("messageCreate", (msg) => {
      if (!msg.guild) return;

      emitDiscordNewMessage({
        accountId: botId,
        guildId: msg.guild.id,
        channelId: msg.channelId,
        message: msg,
        botUserId: client.user?.id ?? null,
      });
    });

    client.on("messageUpdate", (_, newMsg) => {
      const msg = newMsg as Message;
      if (!msg.guild) return;

      emitDiscordEditedMessage({
        accountId: botId,
        guildId: msg.guild.id,
        channelId: msg.channelId,
        message: msg,
        botUserId: client.user?.id ?? null,
      });
    });

    client.on("messageDelete", (msg) => {
      const m = msg as PartialMessage;
      if (!m.guild || !m.channel?.id) return;

      emitDiscordDeletedMessage({
        accountId: botId,
        guildId: m.guild.id,
        channelId: m.channel.id,
        messageId: m.id ?? "",
      });
    });

    client.on("typingStart", (typing: Typing) => {
      emitDiscordTyping({
        accountId: botId,
        guildId: typing.guild?.id ?? "",
        channelId: typing.channel.id,
        userId: typing.user?.id ?? "",
        username: typing.user?.username ?? "",
        isTyping: true,
      });
    });
    client.on("guildCreate", async (guild) => {
      logger.info(
        `[DiscordClientManager] Bot added to new guild: ${guild.id} (${guild.name})`
      );

      // Add guild to runtime
      inst.guilds.set(guild.id, guild.name);

      // Load channels and threads
      const channels = await guild.channels.fetch();

      for (const ch of channels.values()) {
        if (!ch) continue;

        if (isTextChannel(ch) || isForumChannel(ch)) {
          inst.channels.set(ch.id, ch);

          // Завантажити активні/архівні треди
          try {
            const active = await ch.threads.fetchActive();
            active.threads.forEach((t) => inst.threads.set(t.id, t));

            const archived = await ch.threads.fetchArchived();
            archived.threads.forEach((t) => inst.threads.set(t.id, t));
          } catch (err) {
            logger.warn(`[guildCreate] Thread preload failed`, {
              guildId: guild.id,
              channelId: ch.id,
              err,
            });
          }
        }
      }

      logger.info(
        `[DiscordClientManager] Guild added → guilds=${inst.guilds.size} channels=${inst.channels.size} threads=${inst.threads.size}`
      );
    });

    client.on("guildDelete", (guild) => {
      logger.info(
        `[DiscordClientManager] Bot removed from guild: ${guild.id} (${guild.name})`
      );

      inst.guilds.delete(guild.id);

      // Видаляємо канали та треди цієї гільдії
      for (const [id, ch] of inst.channels.entries()) {
        if (ch.guildId === guild.id) inst.channels.delete(id);
      }

      for (const [id, t] of inst.threads.entries()) {
        if (t.guildId === guild.id) inst.threads.delete(id);
      }
    });
  }

  /* ------------------------------------------------------------
     DIALOG TREE — FOR SPECIFIC BOT
     Структура:
     [
       {
         guildId,
         guildName,
         accountId: botId,
         channels: [
           {
             platform: "discord",
             accountId: botId,
             guildId,
             chatId: channel.id,
             name: channel.name,
             discordType: "text" | "forum",
             isThread: false,
             parentId: null,
             threads: [
               {
                 platform: "discord",
                 accountId: botId,
                 guildId,
                 chatId: thread.id,
                 name: thread.name,
                 discordType: "thread",
                 isThread: true,
                 parentId: channel.id,
               }
             ]
           }
         ]
       }
     ]
  ------------------------------------------------------------ */

  /* ------------------------------------------------------------
   DIALOG TREE — FOR SPECIFIC BOT (FIXED VERSION)
   Джерело правди: Discord client.guilds.cache
------------------------------------------------------------ */

  public async getDialogsTree(botId: string) {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const client = inst.client;

    const result: any[] = [];

    /* ------------------------------------------------------------
     * 1) Collect guilds from Discord API (SOURCE OF TRUTH)
     * ------------------------------------------------------------ */
    for (const guild of client.guilds.cache.values()) {
      const guildId = guild.id;
      const guildName = guild.name;

      const guildBlock = {
        guildId,
        guildName,
        accountId: botId,
        channels: [] as any[],
      };

      /* ------------------------------------------------------------
       * 2) Channels (text / forum)
       * ------------------------------------------------------------ */
      for (const ch of inst.channels.values()) {
        if (ch.guildId !== guildId) continue;

        const channelBlock = {
          platform: "discord" as const,
          accountId: botId,
          guildId,
          chatId: ch.id,
          name: ch.name,
          discordType: isForumChannel(ch)
            ? ("forum" as const)
            : ("text" as const),
          isThread: false,
          parentId: null as string | null,
          threads: [] as any[],
        };

        /* ------------------------------------------------------------
         * 3) Threads under channel
         * ------------------------------------------------------------ */
        for (const t of inst.threads.values()) {
          if (t.parentId !== ch.id) continue;

          channelBlock.threads.push({
            platform: "discord" as const,
            accountId: botId,
            guildId,
            chatId: t.id,
            name: t.name,
            discordType: "thread" as const,
            isThread: true,
            parentId: ch.id,
          });
        }

        guildBlock.channels.push(channelBlock);
      }

      /* ------------------------------------------------------------
       * 4) Push guild ONLY if it has channels
       * ------------------------------------------------------------ */
      if (guildBlock.channels.length > 0) {
        result.push(guildBlock);
      }
    }

    return result;
  }

  /* ------------------------------------------------------------
     FETCH HISTORY FOR SPECIFIC BOT
  ------------------------------------------------------------ */

  public async fetchMessages(
    botId: string,
    channelId: string,
    options?: {
      limit?: number;
      beforeMessageId?: string;
    }
  ): Promise<Message<boolean>[]> {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const ch = await inst.client.channels.fetch(channelId);

    if (!ch || !("messages" in ch)) {
      throw new Error(`Channel has no messages: ${channelId}`);
    }

    const channel = ch as TextBasedChannel;

    const fetchOptions: {
      limit: number;
      before?: string;
    } = {
      limit: options?.limit ?? 50,
    };

    if (options?.beforeMessageId) {
      fetchOptions.before = options.beforeMessageId;
    }

    const msgs: Collection<
      string,
      Message<boolean>
    > = await channel.messages.fetch(fetchOptions);

    return Array.from(msgs.values()).sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );
  }

  /* ------------------------------------------------------------
     SEND MESSAGE — SPECIFIC BOT
  ------------------------------------------------------------ */

  public async sendMessage(botId: string, channelId: string, text: string) {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const ch = await inst.client.channels.fetch(channelId);
    if (!isSendableChannel(ch)) throw new Error("Channel not sendable");

    return ch.send(text);
  }

  public async sendFile(
    botId: string,
    channelId: string,
    file: Buffer,
    name: string,
    caption?: string
  ) {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const ch = await inst.client.channels.fetch(channelId);
    if (!isSendableChannel(ch)) throw new Error("Channel not sendable");

    return ch.send({
      content: caption ?? "",
      files: [{ attachment: file, name }],
    });
  }

  /* ------------------------------------------------------------
     EDIT / DELETE MESSAGE
  ------------------------------------------------------------ */

  public async editMessage(
    botId: string,
    channelId: string,
    messageId: string,
    text: string
  ) {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const ch = await inst.client.channels.fetch(channelId);

    if (!ch) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    if (!isSendableChannel(ch)) {
      throw new Error(`Channel not sendable: ${channelId}`);
    }

    const msg = await (ch as TextBasedChannel).messages.fetch(messageId);
    return msg.edit(text);
  }

  public async deleteMessage(
    botId: string,
    channelId: string,
    messageId: string
  ) {
    const inst = this.bots.get(botId);
    if (!inst) throw new Error("Bot not attached for this id");

    const ch = await inst.client.channels.fetch(channelId);

    if (!ch) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    if (!isSendableChannel(ch)) {
      throw new Error(`Channel not sendable: ${channelId}`);
    }

    const msg = await (ch as TextBasedChannel).messages.fetch(messageId);
    await msg.delete();
  }
}

export const discordClientManager = new DiscordClientManager();
