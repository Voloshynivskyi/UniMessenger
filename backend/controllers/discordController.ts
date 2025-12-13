// backend/controllers/discordController.ts
import type { Request, Response } from "express";
import { discordService } from "../services/discord/discordService";
import { logger } from "../utils/logger";

/* ============================================================
   Helpers
============================================================ */
function ok(res: Response, data: any) {
  return res.status(200).json({ status: "ok", data });
}

function err(res: Response, message: string, code = "ERROR", http = 400) {
  return res.status(http).json({ status: "error", message, code });
}

/* ============================================================
   BOTS MANAGEMENT
============================================================ */

export async function discordRegisterBot(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botToken } = req.body;

    if (!botToken) return err(res, "botToken required");

    const bot = await discordService.registerUserBot(userId, botToken);
    return ok(res, { bot });
  } catch (e: any) {
    logger.error("discordRegisterBot failed", { e });
    return err(res, e.message ?? "Register bot failed");
  }
}

export async function discordListBots(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const bots = await discordService.listUserBots(userId);
    return ok(res, { bots });
  } catch (e: any) {
    logger.error("discordListBots failed", { e });
    return err(res, e.message ?? "List bots failed");
  }
}

export async function discordDeactivateBot(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botId } = req.body;

    if (!botId) return err(res, "botId required");

    await discordService.deactivateBot(userId, botId);
    return ok(res, { success: true });
  } catch (e: any) {
    logger.error("discordDeactivateBot failed", { e });
    return err(res, e.message ?? "Deactivate bot failed");
  }
}

export async function discordRefreshBotGuilds(req: Request, res: Response) {
  try {
    const { botId } = req.body;

    if (!botId) return err(res, "botId required");

    const count = await discordService.refreshBotGuilds(botId);
    return ok(res, { guildCount: count });
  } catch (e: any) {
    logger.error("discordRefreshBotGuilds failed", { e });
    return err(res, e.message ?? "Refresh bot guilds failed");
  }
}

/* ============================================================
   DIALOGS / CHATS
============================================================ */

export async function discordGetDialogs(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const dialogs = await discordService.getDialogsForUser(userId);
    return ok(res, { dialogs });
  } catch (e: any) {
    logger.error("discordGetDialogs failed", { e });
    return err(res, e.message ?? "Get dialogs failed");
  }
}

/* ============================================================
   HISTORY
============================================================ */

export async function discordGetHistory(req: Request, res: Response) {
  try {
    const botId = String(req.query.botId ?? "");
    const chatId = String(req.query.chatId ?? "");
    const limit = req.query.limit ? Number(req.query.limit) || 50 : 50;
    const beforeMessageId = req.query.beforeMessageId
      ? String(req.query.beforeMessageId)
      : undefined;
    if (!botId || !chatId) return err(res, "botId & chatId required");

    const messages = await discordService.getHistory(
      botId,
      chatId,
      limit,
      beforeMessageId
    );
    return ok(res, { messages });
  } catch (e: any) {
    logger.error("discordGetHistory failed", { e });
    return err(res, e.message ?? "Get history failed");
  }
}

/* ============================================================
   SEND MESSAGE / FILE
============================================================ */

export async function discordSendMessage(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botId, chatId, text } = req.body;

    // text == null → undefined or null
    if (!botId || !chatId || text == null) {
      return err(res, "botId + chatId + text required");
    }

    const message = await discordService.sendMessage(
      botId,
      chatId,
      text,
      userId
    );
    return ok(res, { message });
  } catch (e: any) {
    logger.error("discordSendMessage failed", { e });
    return err(res, e.message ?? "Send message failed");
  }
}

export async function discordSendFile(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botId, chatId, caption } = req.body;
    const file = req.file;

    if (!botId || !chatId || !file) {
      return err(res, "botId + chatId + file required");
    }

    const message = await discordService.sendFile(
      botId,
      chatId,
      file.buffer,
      file.originalname,
      caption,
      userId
    );

    return ok(res, { message });
  } catch (e: any) {
    logger.error("discordSendFile failed", { e });
    return err(res, e.message ?? "Send file failed");
  }
}

/* ============================================================
   EDIT / DELETE
============================================================ */

export async function discordEditMessage(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botId, chatId, messageId, text } = req.body;

    if (!botId || !chatId || !messageId || text == null) {
      return err(res, "botId + chatId + messageId + text required");
    }

    const message = await discordService.editMessage(
      botId,
      chatId,
      messageId,
      text,
      userId
    );

    return ok(res, { message });
  } catch (e: any) {
    logger.error("discordEditMessage failed", { e });
    return err(res, e.message ?? "Edit message failed");
  }
}

export async function discordDeleteMessage(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botId, chatId, messageId } = req.body;

    if (!botId || !chatId || !messageId) {
      return err(res, "botId + chatId + messageId required");
    }

    const result = await discordService.deleteMessage(
      botId,
      chatId,
      messageId,
      userId
    );

    return ok(res, result);
  } catch (e: any) {
    logger.error("discordDeleteMessage failed", { e });
    return err(res, e.message ?? "Delete message failed");
  }
}
