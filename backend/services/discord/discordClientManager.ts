import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Message,
  NewsChannel,
  Partials,
  TextChannel,
  ThreadChannel,
  User,
  Embed,
} from "discord.js";

import type { TextBasedChannel } from "discord.js";
import util from "node:util";
import { logger } from "../../utils/logger.ts";

/* ------------------------------------------------------------
 * Types
 * ------------------------------------------------------------ */

interface DiscordBotInstance {
  client: Client;
  accountId: string;

  guilds: Map<string, string>;
  channels: Map<string, TextChannel | NewsChannel>;
  threads: Map<string, ThreadChannel>;
  users: Map<string, User>;
}

/* ------------------------------------------------------------
 * Type guards
 * ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
 * DiscordClientManager
 * ------------------------------------------------------------ */

export class DiscordClientManager {
  private clients = new Map<string, DiscordBotInstance>();

  public isClientActive(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  public getClient(accountId: string): Client | undefined {
    return this.clients.get(accountId)?.client;
  }

  /* ------------------------------------------------------------
   * Attach bot
   * ------------------------------------------------------------ */
  public async attachAccount(
    accountId: string,
    botToken: string
  ): Promise<void> {
    if (!botToken) {
      logger.warn(`[DiscordClientManager] No token for ${accountId}`);
      return;
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageTyping,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.User],
    });

    const instance: DiscordBotInstance = {
      client,
      accountId,
      guilds: new Map(),
      channels: new Map(),
      threads: new Map(),
      users: new Map(),
    };

    this.registerEventHandlers(instance);

    try {
      await client.login(botToken);
      logger.info(`[DiscordClientManager] Logged in as ${client.user?.tag}`);
    } catch (err) {
      logger.error(`[DiscordClientManager] Login failed`, { err });
      return;
    }

    await this.preloadStructures(instance);

    this.clients.set(accountId, instance);
    logger.info(`[DiscordClientManager] READY for ${accountId}`);
  }

  /* ------------------------------------------------------------
   * Detach bot
   * ------------------------------------------------------------ */
  public async detachAccount(accountId: string): Promise<void> {
    const inst = this.clients.get(accountId);
    if (!inst) return;

    try {
      await inst.client.destroy();
    } catch (err) {
      logger.warn(`[DiscordClientManager] Destroy error`, { err });
    }

    this.clients.delete(accountId);
    logger.info(`[DiscordClientManager] Detached ${accountId}`);
  }

  /* ------------------------------------------------------------
   * Preload structures
   * ------------------------------------------------------------ */
  private async preloadStructures(inst: DiscordBotInstance): Promise<void> {
    const client = inst.client;

    for (const [guildId, guild] of client.guilds.cache) {
      inst.guilds.set(guildId, guild.name);

      const channels = await guild.channels.fetch();

      channels.forEach((ch) => {
        if (!ch) return;

        if (isTextChannel(ch)) {
          inst.channels.set(ch.id, ch);
        }

        if (isThreadChannel(ch)) {
          const thread = ch as ThreadChannel;
          inst.threads.set(thread.id, thread);
        }
      });

      // Active threads
      const threadManager: any = (guild as any).threads;
      if (threadManager?.fetchActive) {
        try {
          const res: any = await threadManager.fetchActive();
          res.threads.forEach((t: ThreadChannel) => {
            inst.threads.set(t.id, t);
          });
        } catch (err) {
          logger.warn(`[DiscordClientManager] Failed to load threads`, { err });
        }
      }
    }

    logger.info(
      `[DiscordClientManager] Preloaded: guilds=${inst.guilds.size}, channels=${inst.channels.size}, threads=${inst.threads.size}`
    );
  }

  /* ------------------------------------------------------------
   * Event handlers — FULL RAW LOGGING
   * ------------------------------------------------------------ */
  private registerEventHandlers(inst: DiscordBotInstance): void {
    const client = inst.client;
    const acc = inst.accountId;

    client.on("ready", () => {
      logger.info(
        `[DiscordClientManager] Client ready for ${acc} as ${client.user?.tag}`
      );
    });

    /* ----------------------- NEW MESSAGE ----------------------- */
    client.on("messageCreate", (msg: Message) => {
      if (!msg.guild) return;

      inst.users.set(msg.author.id, msg.author);

      const channelName = (msg.channel as any)?.name ?? "unknown";

      logger.info(`[Discord][${acc}] NEW message in #${channelName}`);

      const raw = {
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
        },
        createdAt: msg.createdAt,
        attachments: msg.attachments.map((a) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          contentType: a.contentType,
          width: a.width,
          height: a.height,
        })),
        embeds: msg.embeds.map((e: Embed) => ({
          title: e.title,
          description: e.description,
          // type більше недоступне — видаляємо
          url: e.url,
        })),
      };

      logger.info(
        `[Discord][${acc}] RAW MESSAGE:\n${util.inspect(raw, {
          depth: 6,
          colors: false,
        })}`
      );
    });

    /* ----------------------- UPDATE ----------------------- */
    client.on("messageUpdate", (_, newMsg) => {
      const msg = newMsg as Message;
      const chName = (msg.channel as any)?.name ?? "unknown";

      logger.info(`[Discord][${acc}] EDIT message ${msg.id} in #${chName}`);
    });

    /* ------------------------ DELETE ----------------------- */
    client.on("messageDelete", (msg) => {
      logger.info(`[Discord][${acc}] DELETE message ${msg.id}`);
    });

    /* ----------------------- TYPING ------------------------- */
    client.on("typingStart", (typing) => {
      const chName = (typing.channel as any)?.name ?? "unknown";

      logger.info(
        `[Discord][${acc}] TYPING in #${chName} by ${typing.user?.username}`
      );
    });

    /* ------------------------ THREADS ------------------------ */
    client.on("threadCreate", (thread: ThreadChannel) => {
      inst.threads.set(thread.id, thread);
      logger.info(`[Discord][${acc}] THREAD created: ${thread.name}`);
    });

    client.on("error", (err) => {
      logger.error(`[DiscordClientManager] Error`, { err });
    });

    client.on("shardError", (err) => {
      logger.error(`[DiscordClientManager] Shard error`, { err });
    });
  }

  /* ------------------------------------------------------------
   * Fetch messages
   * ------------------------------------------------------------ */
  public async fetchMessages(
    accountId: string,
    channelId: string,
    limit = 50
  ): Promise<Message[]> {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error(`Account not attached`);

    const ch = await inst.client.channels.fetch(channelId);
    if (!ch || !("messages" in ch)) throw new Error(`Channel has no messages`);

    const messages = await (ch as TextBasedChannel).messages.fetch({ limit });

    return Array.from(messages.values());
  }

  /* ------------------------------------------------------------
   * Send message
   * ------------------------------------------------------------ */
  public async sendMessage(
    accountId: string,
    channelId: string,
    text: string
  ): Promise<Message> {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error(`Account not attached`);

    const ch = await inst.client.channels.fetch(channelId);
    if (!isSendableChannel(ch)) throw new Error(`Cannot send to channel`);

    return await ch.send(text);
  }

  /* ------------------------------------------------------------
   * Send file
   * ------------------------------------------------------------ */
  public async sendFile(
    accountId: string,
    channelId: string,
    fileBuf: Buffer,
    fileName: string,
    caption?: string
  ): Promise<Message> {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error(`Account not attached`);

    const ch = await inst.client.channels.fetch(channelId);
    if (!isSendableChannel(ch)) throw new Error(`Cannot send to channel`);

    return await ch.send({
      content: caption ?? "",
      files: [{ attachment: fileBuf, name: fileName }],
    });
  }
}

const discordClientManager = new DiscordClientManager();
export default discordClientManager;
