// frontend/src/api/discordApi.ts

import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";
import type { UnifiedDiscordMessage } from "../types/discord.types";

/**
 * Один Discord-акаунт (бот) у системі
 * Відповідає backend/prisma/schema.prisma::DiscordAccount
 */
export interface DiscordAccount {
  id: string;
  userId: string;

  botToken: string; // ⚠ бек зараз реально віддає
  botUserId: string | null;
  botUsername: string | null;

  isActive: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Канал/тред з /discord/dialogs
 */
export interface DiscordDialogChannel {
  id: string;
  name: string;
  type: "text" | "announcement" | "forum" | "thread";
  parentId: string | null;
}

/**
 * Один guild із каналами
 */
export interface DiscordDialogGuild {
  guildId: string;
  guildName: string;
  channels: DiscordDialogChannel[];
}

export const discordApi = {
  // ADD ACCOUNT
  // POST /api/discord/addAccount
  async addAccount(botToken: string): Promise<DiscordAccount> {
    if (!botToken) throw new Error("botToken is required");

    const response = await apiClient.post("/api/discord/addAccount", {
      botToken,
    });

    const data = handleApiResponse<{ account: DiscordAccount }>(response);
    return data.account;
  },

  // REMOVE / DEACTIVATE
  // POST /api/discord/removeAccount
  async removeAccount(accountId: string): Promise<{ status: string }> {
    if (!accountId) throw new Error("accountId is required");

    const response = await apiClient.post("/api/discord/removeAccount", {
      accountId,
    });

    return handleApiResponse<{ status: string }>(response);
  },

  // LIST ACCOUNTS
  // GET /api/discord/accounts
  async getAccounts(): Promise<DiscordAccount[]> {
    const response = await apiClient.get("/api/discord/accounts");
    const data = handleApiResponse<{ accounts: DiscordAccount[] }>(response);
    return data.accounts;
  },

  // LIST GUILDS + CHANNELS + THREADS
  // GET /api/discord/dialogs
  async getDialogs(accountId: string): Promise<DiscordDialogGuild[]> {
    if (!accountId) throw new Error("accountId is required");

    const response = await apiClient.get("/api/discord/dialogs", {
      params: { accountId },
    });

    const data = handleApiResponse<{ dialogs: DiscordDialogGuild[] }>(response);
    return data.dialogs;
  },

  // MESSAGE HISTORY
  // GET /api/discord/history
  async getHistory(params: {
    accountId: string;
    channelId: string;
    limit?: number;
  }): Promise<UnifiedDiscordMessage[]> {
    const { accountId, channelId, limit = 50 } = params;

    if (!accountId || !channelId) {
      throw new Error("accountId and channelId are required");
    }

    const response = await apiClient.get("/api/discord/history", {
      params: { accountId, channelId, limit },
    });

    const data = handleApiResponse<{ messages: UnifiedDiscordMessage[] }>(
      response
    );

    return data.messages;
  },

  // SEND TEXT
  // POST /api/discord/sendMessage
  async sendText(params: {
    accountId: string;
    channelId: string;
    text: string;
  }): Promise<UnifiedDiscordMessage> {
    const { accountId, channelId, text } = params;

    if (!accountId || !channelId || !text) {
      throw new Error("accountId, channelId and text are required");
    }

    const response = await apiClient.post("/api/discord/sendMessage", {
      accountId,
      channelId,
      text,
    });

    const data = handleApiResponse<{ message: UnifiedDiscordMessage }>(
      response
    );

    return data.message;
  },

  // SEND FILE
  // POST /api/discord/sendFile (multipart)
  async sendFile(params: {
    accountId: string;
    channelId: string;
    file: File;
    caption?: string;
  }): Promise<UnifiedDiscordMessage> {
    const { accountId, channelId, file, caption } = params;

    if (!accountId || !channelId || !file) {
      throw new Error("accountId, channelId and file are required");
    }

    const form = new FormData();
    form.append("accountId", accountId);
    form.append("channelId", channelId);
    if (caption) form.append("caption", caption);
    form.append("file", file);

    const response = await apiClient.post("/api/discord/sendFile", form);

    const data = handleApiResponse<{ message: UnifiedDiscordMessage }>(
      response
    );

    return data.message;
  },
};
