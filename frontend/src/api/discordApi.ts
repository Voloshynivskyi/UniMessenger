// frontend/src/api/discordApi.ts
import apiClient from "./apiClient";
import { handleApiResponse } from "./handleApiResponse";
import type { UnifiedDiscordMessage } from "../types/discord.types";

interface DiscordHistoryParams {
  beforeMessageId?: string;
  limit?: number;
}

export const discordApi = {
  /* ---------------------- BOTS ---------------------- */

  async registerBot(botToken: string) {
    const res = await apiClient.post("/api/discord/bots/register", {
      botToken,
    });
    return handleApiResponse<{ bot: any }>(res);
  },

  async listBots() {
    const res = await apiClient.get("/api/discord/bots");
    return handleApiResponse<{ bots: any[] }>(res);
  },

  async deactivateBot(botId: string) {
    const res = await apiClient.post("/api/discord/bots/deactivate", {
      botId,
    });
    return handleApiResponse<{ success: boolean }>(res);
  },

  async refreshGuilds(botId: string) {
    const res = await apiClient.post("/api/discord/bots/refresh-guilds", {
      botId,
    });
    return handleApiResponse<{ guildCount: number }>(res);
  },

  /* ---------------------- DIALOGS + TREE ---------------------- */

  async getDialogs() {
    const res = await apiClient.get("/api/discord/dialogs");
    return handleApiResponse<{ dialogs: any[] }>(res);
  },

  /* ---------------------- HISTORY ---------------------- */

  async getHistory(
    botId: string,
    chatId: string,
    params?: DiscordHistoryParams
  ) {
    const res = await apiClient.get("/api/discord/history", {
      params: {
        botId,
        chatId,
        ...(params?.beforeMessageId
          ? { beforeMessageId: params.beforeMessageId }
          : {}),
        ...(typeof params?.limit === "number" ? { limit: params.limit } : {}),
      },
    });

    return handleApiResponse<{ messages: UnifiedDiscordMessage[] }>(res);
  },

  /* ---------------------- SEND MESSAGE ---------------------- */

  async sendText(botId: string, chatId: string, text: string) {
    const res = await apiClient.post("/api/discord/sendMessage", {
      botId,
      chatId,
      text,
    });

    return handleApiResponse<{ message: UnifiedDiscordMessage }>(res);
  },

  /**
   * SEND FILE (multipart/form-data)
   *
   * IMPORTANT:
   * - Do NOT set Content-Type manually
   * - apiClient (axios) will set boundary automatically
   * - "file" field must match multer.single("file") on backend
   */
  async sendFile(botId: string, chatId: string, file: File, caption?: string) {
    const form = new FormData();

    form.append("botId", botId);
    form.append("chatId", chatId);

    if (caption && caption.trim().length > 0) {
      form.append("caption", caption);
    }

    // Key field - must match multer.single("file")
    form.append("file", file, file.name);

    const res = await apiClient.post("/api/discord/sendFile", form, {
      // No headers needed here
      // axios will set multipart/form-data + boundary automatically
    });

    return handleApiResponse<{ message: UnifiedDiscordMessage }>(res);
  },

  /* ---------------------- EDIT + DELETE ---------------------- */

  async editMessage(
    botId: string,
    chatId: string,
    messageId: string,
    text: string
  ) {
    const res = await apiClient.post("/api/discord/editMessage", {
      botId,
      chatId,
      messageId,
      text,
    });

    return handleApiResponse<{ message: UnifiedDiscordMessage }>(res);
  },

  async deleteMessage(botId: string, chatId: string, messageId: string) {
    const res = await apiClient.post("/api/discord/deleteMessage", {
      botId,
      chatId,
      messageId,
    });

    return handleApiResponse<{ ok: boolean }>(res);
  },
};
