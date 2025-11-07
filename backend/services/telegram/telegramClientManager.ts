// backend/services/telegram/telegramClientManager.ts

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { prisma } from "../../lib/prisma";
import { decryptSession } from "../../utils/telegramSession";
import { logger } from "../../utils/logger";

const API_ID = process.env.TELEGRAM_API_ID
  ? Number(process.env.TELEGRAM_API_ID)
  : undefined;
const API_HASH = process.env.TELEGRAM_API_HASH;

if (!API_ID || !API_HASH) {
  console.warn(
    "[TelegramClientManager] TELEGRAM_API_ID or TELEGRAM_API_HASH is not set. Telegram clients will not work correctly."
  );
}

export class TelegramClientManager {
  // Key: telegramAccountId
  private clients = new Map<string, TelegramClient>();

  // Key: telegramAccountId, Value: unimessengerUserId
  private accountToUser = new Map<string, string>();

  // For control of repeatable attachAllForUser
  private initializedForUser = new Set<string>();

  // For simple control of client restarts
  private reconnectAttempts = new Map<string, number>();

  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 5_000;

  // Get the Telegram client for a specific Telegram account
  public getClient(accountId: string): TelegramClient | undefined {
    return this.clients.get(accountId);
  }
  // Check if a Telegram client is active for a specific Telegram account
  public isClientActive(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  // Attach and initialize a Telegram client for a specific Telegram account
  public async attachAccount(
    accountId: string,
    userId?: string,
    encryptedSession?: string
  ): Promise<void> {
    if (!API_ID || !API_HASH) return;

    // If client already exists - do nothing
    if (this.clients.has(accountId)) {
      logger.warn(
        `[TelegramClientManager] Client already exists for account ${accountId}, skipping`
      );
      return;
    }

    let sessionString = encryptedSession;
    let resolvedUserId = userId;

    // If userId/session not provided - fetch from database
    if (!sessionString || !resolvedUserId) {
      const account = await prisma.telegramAccount.findUnique({
        where: { id: accountId },
        include: { session: true, user: true },
      });

      if (!account || !account.session || !account.session.sessionString) {
        logger.warn(
          `[TelegramClientManager] Cannot attach account ${accountId}: no session`
        );
        return;
      }

      sessionString = account.session.sessionString;
      resolvedUserId = account.userId;
    }

    if (!sessionString || !resolvedUserId) {
      logger.warn(
        `[TelegramClientManager] Missing userId/session for account ${accountId}`
      );
      return;
    }

    // 1. Decrypt MTProto session
    const decrypted = decryptSession(sessionString);
    const stringSession = new StringSession(decrypted);

    // 2. Create client
    const client = new TelegramClient(stringSession, API_ID!, API_HASH!, {
      connectionRetries: 5,
    });

    try {
      // 3. Connect to Telegram
      await client.connect();

      // 4. Subscribe to updates (currently just a logger stub)
      this.subscribeToUpdates(accountId, resolvedUserId, client);

      // 5. Store in maps
      this.clients.set(accountId, client);
      this.accountToUser.set(accountId, resolvedUserId);
      this.reconnectAttempts.set(accountId, 0);

      logger.info(
        `[TelegramClientManager] Attached Telegram client for account ${accountId} (user ${resolvedUserId})`
      );
    } catch (error) {
      logger.error(
        `[TelegramClientManager] Failed to connect Telegram client for account ${accountId}`,
        error!
      );
      // 6. Schedule automatic reconnect
      this.scheduleReconnect(accountId);
    }
  }

  // Attach and init clients for all active Telegram accounts of a given unimessenger user
  public async attachAllForUser(userId: string): Promise<void> {
    if (!API_ID || !API_HASH) return;
    logger.info(`[TelegramClientManager] attachAllForUser(${userId}) called`);
    // If we already initialized clients for this user during server lifetime - don't do it again
    if (this.initializedForUser.has(userId)) {
      return;
    }

    const accounts = await prisma.telegramAccount.findMany({
      where: {
        userId,
        isActive: true, // DB should have a field that shows the account is valid/authorized
      },
      include: {
        session: true, // assuming TelegramSession is linked as session
      },
    });

    if (!accounts.length) {
      // no active accounts - just mark that there's nothing to create for this user
      this.initializedForUser.add(userId);
      return;
    }

    for (const acc of accounts) {
      if (!acc.session || !acc.session.sessionString) {
        logger.warn(
          `[TelegramClientManager] User ${userId} account ${acc.id} has no session`
        );
        continue;
      }

      await this.attachAccount(acc.id, userId, acc.session.sessionString);
    }

    this.initializedForUser.add(userId);
  }

  // Detach a Telegram client for a specific Telegram account
  public async detachAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (!client) return;

    try {
      await client.disconnect();
    } catch (error) {
      logger.warn(
        `[TelegramClientManager] Error while disconnecting account ${accountId}`,
        error!
      );
    }

    this.clients.delete(accountId);
    this.accountToUser.delete(accountId);
    this.reconnectAttempts.delete(accountId);

    logger.info(
      `[TelegramClientManager] Detached Telegram client for account ${accountId}`
    );
  }

  // Detach all Telegram clients for a specific unimessenger user
  public async detachAllForUser(userId: string): Promise<void> {
    for (const [accountId, ownerId] of this.accountToUser.entries()) {
      if (ownerId === userId) {
        await this.detachAccount(accountId);
      }
    }

    this.initializedForUser.delete(userId);

    logger.info(
      `[TelegramClientManager] Detached all Telegram clients for user ${userId}`
    );
  }
  // Schedule a reconnect attempt for a specific Telegram account
  private scheduleReconnect(accountId: string): void {
    const attempts = (this.reconnectAttempts.get(accountId) || 0) + 1;

    if (attempts > this.maxReconnectAttempts) {
      logger.error(
        `[TelegramClientManager] Max reconnect attempts reached for account ${accountId}. Giving up.`
      );
      this.clients.delete(accountId);
      this.reconnectAttempts.delete(accountId);
      return;
    }

    this.reconnectAttempts.set(accountId, attempts);

    logger.info(
      `[TelegramClientManager] Scheduling reconnect #${attempts} for account ${accountId} in ${this.reconnectDelayMs}ms`
    );

    setTimeout(async () => {
      await this.attachAccount(accountId);
    }, this.reconnectDelayMs);
  }

  // Subscribe to Telegram updates for a specific account
  private subscribeToUpdates(
    accountId: string,
    userId: string,
    client: TelegramClient
  ): void {
    // TODO: later here:
    // - parse updates
    // - call realtimeHub.* to go to Socket.IO

    // Example stub, for now just watching what comes in:
    // @ts-ignore - depends on specific telegram API
    client.addEventHandler((update: any) => {
      const type = update?.constructor?.name ?? "UnknownUpdate";
      logger.info(
        `[TelegramClientManager] Update for account ${accountId} (user ${userId}): ${type}`
      );

      // Log some details for common update types
      if (update?.message?.message) {
        logger.info(`↳ Text: ${update.message.message}`);
      }
      if (update?.user?.firstName) {
        logger.info(`↳ User: ${update.user.firstName}`);
      }
    });
  }
}

const telegramClientManager = new TelegramClientManager();
export default telegramClientManager;
