// backend/services/discord/discordClientManager.ts
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
  ForumChannel,
} from "discord.js";
import {
  emitDiscordNewMessage,
  emitDiscordEditedMessage,
  emitDiscordDeletedMessage,
} from "../../realtime/handlers/discord/discordUpdteHandlers";
import { emitDiscordTyping } from "../../realtime/handlers/discord/discordUpdteHandlers";

import type { TextBasedChannel, PartialMessage, Typing } from "discord.js";
import util from "node:util";
import { logger } from "../../utils/logger";

// Types

interface DiscordBotInstance {
  client: Client;
  accountId: string;

  guilds: Map<string, string>;
  channels: Map<string, TextChannel | NewsChannel | ForumChannel>;
  threads: Map<string, ThreadChannel>;
  users: Map<string, User>;
}

// Type guards

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

// Logger helpers

function serializeMessageForLog(msg: Message | PartialMessage) {
  const attachments =
    "attachments" in msg && msg.attachments
      ? Array.from(msg.attachments.values()).map((a) => ({
          id: a.id,
          name: a.name,
          url: a.url,
        }))
      : [];

  const embeds =
    "embeds" in msg && msg.embeds
      ? msg.embeds.map((e: Embed) => ({
          title: e.title ?? null,
          description: e.description ?? null,
          url: e.url ?? null,
        }))
      : [];

  const author =
    "author" in msg && msg.author
      ? {
          id: msg.author.id,
          username: msg.author.username,
        }
      : null;

  return {
    id: msg.id,
    content: "content" in msg ? msg.content : null,
    author,
    createdAt: "createdAt" in msg ? (msg as any).createdAt : null,
    attachments,
    embeds,
  };
}

// DiscordClientManager

export class DiscordClientManager {
  private clients = new Map<string, DiscordBotInstance>();

  public isClientActive(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  public getClient(accountId: string): Client | undefined {
    return this.clients.get(accountId)?.client;
  }

  // Attach bot
  public async attachAccount(accountId: string, botToken: string) {
    if (this.clients.has(accountId)) {
      logger.info(
        `[DiscordClientManager] attachAccount: client already active for ${accountId}`
      );
      return;
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessageReactions,

        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
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
      logger.info(
        `[DiscordClientManager] Logged in as ${client.user?.tag} for account=${accountId}`
      );
    } catch (err) {
      logger.error(
        `[DiscordClientManager] Login failed for account=${accountId}`,
        { err }
      );
      return;
    }

    try {
      await this.preloadStructures(instance);
    } catch (err) {
      logger.warn(
        `[DiscordClientManager] preloadStructures failed for account=${accountId}`,
        { err }
      );
    }

    this.clients.set(accountId, instance);
    logger.info(`[DiscordClientManager] READY for ${accountId}`);
  }

  // Detach bot
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

  // Preload guilds + channels + ALL THREADS (forums + text)
  private async preloadStructures(inst: DiscordBotInstance) {
    const client = inst.client;

    logger.info(
      `[DiscordClientManager] preloadStructures START for account=${inst.accountId}`
    );

    for (const [, guild] of client.guilds.cache) {
      inst.guilds.set(guild.id, guild.name);

      logger.info(
        `[DiscordClientManager] preload guild=${guild.name} (${guild.id})`
      );

      const channels = await guild.channels.fetch();
      logger.info(
        `[DiscordClientManager] guild=${guild.name} rawChannels=${channels.size}`
      );

      for (const ch of channels.values()) {
        if (!ch) continue;

        const typeName =
          typeof ch.type === "number"
            ? ChannelType[ch.type]
            : String((ch as any).type);

        logger.info(
          `[DiscordClientManager]   [RAW] id=${ch.id} name=${
            (ch as any).name ?? "no-name"
          } type=${ch.type} (${typeName})`
        );

        // TEXT / ANNOUNCEMENT
        if (isTextChannel(ch)) {
          inst.channels.set(ch.id, ch);
          logger.info(
            `[DiscordClientManager]   -> TEXT/ANN stored id=${ch.id} name=${ch.name}`
          );

          // 🔥 Threads, створені з цього текстового / announcement каналу
          try {
            const active = await ch.threads.fetchActive();
            active.threads.forEach((t: ThreadChannel) => {
              inst.threads.set(t.id, t);
              logger.info(
                `[DiscordClientManager]   -> THREAD (active) id=${t.id} name=${t.name} parentId=${t.parentId}`
              );
            });

            const archived = await ch.threads.fetchArchived();
            archived.threads.forEach((t: ThreadChannel) => {
              inst.threads.set(t.id, t);
              logger.info(
                `[DiscordClientManager]   -> THREAD (archived) id=${t.id} name=${t.name} parentId=${t.parentId}`
              );
            });
          } catch (err) {
            logger.warn(
              `[DiscordClientManager] Failed to load text-channel threads for ch=${ch.id}`,
              { err }
            );
          }
        }

        // FORUM + його пости (threads)
        if (isForumChannel(ch)) {
          inst.channels.set(ch.id, ch);
          logger.info(
            `[DiscordClientManager]   -> FORUM stored id=${ch.id} name=${ch.name}`
          );

          try {
            const active = await ch.threads.fetchActive();
            active.threads.forEach((t: ThreadChannel) => {
              inst.threads.set(t.id, t);
              logger.info(
                `[DiscordClientManager]   -> FORUM THREAD (active) id=${t.id} name=${t.name} parentId=${t.parentId}`
              );
            });

            const archived = await ch.threads.fetchArchived();
            archived.threads.forEach((t: ThreadChannel) => {
              inst.threads.set(t.id, t);
              logger.info(
                `[DiscordClientManager]   -> FORUM THREAD (archived) id=${t.id} name=${t.name} parentId=${t.parentId}`
              );
            });
          } catch (err) {
            logger.warn(
              `[DiscordClientManager] Failed to load forum threads for ch=${ch.id}`,
              { err }
            );
          }
        }
      }
    }

    logger.info(
      `[DiscordClientManager] preload DONE for account=${inst.accountId}: guilds=${inst.guilds.size}, channels=${inst.channels.size}, threads=${inst.threads.size}`
    );
  }

  // Event handlers
  private registerEventHandlers(inst: DiscordBotInstance) {
    const client = inst.client;
    const acc = inst.accountId;

    client.on("ready", () => {
      logger.info(
        `[DiscordClientManager] Client ready for ${acc} as ${client.user?.tag}`
      );
    });

    client.on("error", (err) => {
      logger.error(`[DiscordClientManager] Client error`, { err });
    });

    // NEW MESSAGE
    client.on("messageCreate", async (msg: Message) => {
      if (!msg.guild) return;

      inst.users.set(msg.author.id, msg.author);

      const channelName = (msg.channel as any)?.name ?? "unknown";

      logger.info(
        `[Discord][${acc}] NEW message in #${channelName} (chId=${msg.channelId})`
      );

      // If message is in a thread — register that thread
      const ch = msg.channel;
      if (isThreadChannel(ch)) {
        const thread = ch as ThreadChannel;
        if (!inst.threads.has(thread.id)) {
          inst.threads.set(thread.id, thread);
          logger.info(
            `[Discord][${acc}] Registered THREAD from messageCreate: ${thread.name} (${thread.id}) parent=${thread.parentId}`
          );
        }
      }

      const raw = serializeMessageForLog(msg);
      logger.info(
        `[Discord][${acc}] RAW MESSAGE:\n${util.inspect(raw, {
          depth: 5,
          colors: false,
        })}`
      );

      try {
        await emitDiscordNewMessage(acc, msg);
      } catch (err) {
        logger.error(`[Discord][${acc}] emitDiscordNewMessage failed`, { err });
      }
    });

    // EDIT MESSAGE
    client.on("messageUpdate", async (oldMsg, newMsg) => {
      const msg = newMsg as Message | PartialMessage;

      const channelName =
        (msg.channel as any)?.name ??
        (oldMsg.channel as any)?.name ??
        "unknown";

      logger.info(
        `[Discord][${acc}] EDIT message ${msg.id} in #${channelName}`
      );

      const raw = {
        old: serializeMessageForLog(oldMsg as Message | PartialMessage),
        new: serializeMessageForLog(msg),
      };

      logger.info(
        `[Discord][${acc}] RAW EDIT:\n${util.inspect(raw, {
          depth: 5,
          colors: false,
        })}`
      );

      try {
        await emitDiscordEditedMessage(acc, msg as any);
      } catch (err) {
        logger.error(`[Discord][${acc}] emitDiscordEditedMessage failed`, {
          err,
        });
      }
    });

    // DELETE MESSAGE
    client.on("messageDelete", async (msg: Message | PartialMessage) => {
      const channelName = (msg.channel as any)?.name ?? "unknown";

      logger.info(
        `[Discord][${acc}] DELETE message ${msg.id} in #${channelName}`
      );

      const raw = serializeMessageForLog(msg);
      logger.info(
        `[Discord][${acc}] RAW DELETE:\n${util.inspect(raw, {
          depth: 5,
          colors: false,
        })}`
      );

      try {
        const channelId = (msg.channel as any)?.id;
        if (channelId && msg.id) {
          await emitDiscordDeletedMessage(acc, channelId, msg.id);
        }
      } catch (err) {
        logger.error(`[Discord][${acc}] emitDiscordDeletedMessage failed`, {
          err,
        });
      }
    });

    // TYPING
    client.on("typingStart", async (typing: Typing) => {
      const chName = (typing.channel as any)?.name ?? "unknown";

      logger.info(
        `[Discord][${acc}] TYPING in #${chName} by ${typing.user?.username}`
      );

      const chatId = typing.channel?.id;
      const userId = typing.user?.id;
      const username = typing.user?.username;

      if (chatId && userId && username) {
        try {
          await emitDiscordTyping(acc, chatId, userId, username, true);
        } catch (err) {
          logger.error(`[Discord][${acc}] emitDiscordTyping failed`, { err });
        }
      }
    });

    // THREAD CREATE
    client.on("threadCreate", (thread: ThreadChannel) => {
      inst.threads.set(thread.id, thread);

      logger.info(
        `[Discord][${acc}] THREAD created: ${thread.name} (${thread.id}) parent=${thread.parentId}`
      );

      const raw = {
        id: thread.id,
        name: thread.name,
        parentId: thread.parentId,
        guildId: thread.guildId,
        archived: thread.archived,
        locked: thread.locked,
        ownerId: thread.ownerId,
        createdAt: (thread as any).createdAt ?? null,
      };

      logger.info(
        `[Discord][${acc}] RAW THREAD:\n${util.inspect(raw, {
          depth: 5,
          colors: false,
        })}`
      );
    });
  }

  // Fetch messages
  public async fetchMessages(
    accountId: string,
    channelId: string,
    limit = 50
  ): Promise<Message[]> {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error(`Account not attached`);

    const ch = await inst.client.channels.fetch(channelId);
    if (!ch || !("messages" in ch)) {
      throw new Error(`Channel has no messages (id=${channelId})`);
    }

    const messages = await (ch as TextBasedChannel).messages.fetch({ limit });
    return Array.from(messages.values());
  }

  /* ------------------------------------------------------------ */
  /* Send message */
  // Send message
  public async sendMessage(
    accountId: string,
    channelId: string,
    text: string
  ): Promise<Message> {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error(`Account not attached`);

    const ch = await inst.client.channels.fetch(channelId);
    if (!isSendableChannel(ch)) {
      throw new Error(`Cannot send to channel (id=${channelId})`);
    }

    const sent = await ch.send(text);
    logger.info(
      `[DiscordClientManager] Sent message ${sent.id} to channel ${channelId}`
    );

    return sent;
  }

  // Send file
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
    if (!ch || !("send" in ch)) {
      throw new Error(`Cannot send file to this channel (id=${channelId})`);
    }

    const sent = await (ch as any).send({
      content: caption ?? "",
      files: [{ attachment: fileBuf, name: fileName }],
    });

    logger.info(
      `[DiscordClientManager] Sent file ${fileName} to channel ${channelId} msgId=${sent.id}`
    );

    return sent as Message;
  }

  // Get dialogs tree
  public async getDialogsTree(accountId: string) {
    const inst = this.clients.get(accountId);
    if (!inst) throw new Error("Discord client not active");

    const result: {
      guildId: string;
      guildName: string;
      channels: {
        id: string;
        name: string;
        type: "text" | "announcement" | "forum" | "thread";
        parentId: string | null;
      }[];
    }[] = [];

    logger.info(
      `[DiscordClientManager] getDialogsTree for account=${accountId} ` +
        `(guilds=${inst.guilds.size}, channels=${inst.channels.size}, threads=${inst.threads.size})`
    );

    const client = inst.client;

    for (const [, guild] of client.guilds.cache) {
      const entries: {
        id: string;
        name: string;
        type: "text" | "announcement" | "forum" | "thread";
        parentId: string | null;
      }[] = [];

      logger.info(
        `[DiscordClientManager] getDialogsTree: guild=${guild.name} (${guild.id})`
      );

      const channels = await guild.channels.fetch();

      channels.forEach((ch) => {
        if (!ch) return;

        const typeName =
          typeof ch.type === "number"
            ? ChannelType[ch.type]
            : String((ch as any).type);

        logger.info(
          `[DiscordClientManager]   [DLG RAW] id=${ch.id} name=${
            (ch as any).name ?? "no-name"
          } type=${ch.type} (${typeName})`
        );

        if (isTextChannel(ch)) {
          const typeLabel: "text" | "announcement" =
            ch.type === ChannelType.GuildAnnouncement ? "announcement" : "text";

          entries.push({
            id: ch.id,
            name: ch.name,
            type: typeLabel,
            parentId: null,
          });
        }

        if (isForumChannel(ch)) {
          entries.push({
            id: ch.id,
            name: ch.name,
            type: "forum",
            parentId: null,
          });
        }
      });

      inst.threads.forEach((thread) => {
        if (thread.guildId !== guild.id) return;

        entries.push({
          id: thread.id,
          name: thread.name,
          type: "thread",
          parentId: thread.parentId ?? null,
        });
      });

      logger.info(
        `[DiscordClientManager]   RESULT guild=${guild.name}: entries=${entries.length}`
      );

      result.push({
        guildId: guild.id,
        guildName: guild.name,
        channels: entries,
      });
    }

    logger.info(
      `[DiscordClientManager] getDialogsTree DONE for account=${accountId}, guilds=${result.length}`
    );

    return result;
  }
}

const discordClientManager = new DiscordClientManager();
export default discordClientManager;
