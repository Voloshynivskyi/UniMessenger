// backend/controllers/discordController.ts
import type { Request, Response } from "express";
import { discordService } from "../services/discord/discordService";
import { logger } from "../utils/logger";

interface ApiSuccessResponse<T = unknown> {
  status: "ok";
  data: T;
}

interface ApiErrorResponse {
  status: "error";
  message: string;
  code?: string;
}

function sendOk<T>(res: Response, data: T, http = 200) {
  const body: ApiSuccessResponse<T> = { status: "ok", data };
  return res.status(http).json(body);
}

function sendError(
  res: Response,
  message: string,
  code = "UNEXPECTED",
  http = 500
) {
  const body: ApiErrorResponse = { status: "error", message, code };
  return res.status(http).json(body);
}

// POST /discord/addAccount
export async function discordAddAccount(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { botToken } = req.body;

    if (!botToken || typeof botToken !== "string") {
      return sendError(res, "botToken is required", "BAD_REQUEST", 400);
    }

    const account = await discordService.addAccount(userId, botToken);
    return sendOk(res, { account });
  } catch (err: any) {
    logger.error("[discordAddAccount] failed", { err });
    return sendError(res, err.message ?? "Failed to add Discord account");
  }
}

// POST /discord/removeAccount
export async function discordRemoveAccount(req: Request, res: Response) {
  try {
    const { accountId } = req.body;

    if (!accountId || typeof accountId !== "string") {
      return sendError(res, "accountId is required", "BAD_REQUEST", 400);
    }

    const result = await discordService.removeAccount(accountId);
    return sendOk(res, result);
  } catch (err: any) {
    logger.error("[discordRemoveAccount] failed", { err });
    return sendError(res, err.message ?? "Failed to remove Discord account");
  }
}

// GET /discord/accounts
export async function discordGetAccounts(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const accounts = await discordService.getAccounts(userId);
    return sendOk(res, { accounts });
  } catch (err: any) {
    logger.error("[discordGetAccounts] failed", { err });
    return sendError(res, err.message ?? "Failed to load Discord accounts");
  }
}

// GET /discord/dialogs
export async function discordGetDialogs(req: Request, res: Response) {
  try {
    const { accountId } = req.query as { accountId?: string };

    if (!accountId || typeof accountId !== "string") {
      return sendError(res, "accountId is required", "BAD_REQUEST", 400);
    }

    const dialogs = await discordService.getDialogs(accountId);
    return sendOk(res, { dialogs });
  } catch (err: any) {
    logger.error("[discordGetDialogs] failed", { err });
    return sendError(res, err.message ?? "Failed to load Discord dialogs");
  }
}

// GET /discord/history
export async function discordGetHistory(req: Request, res: Response) {
  try {
    const { accountId, channelId, limit } = req.query as {
      accountId?: string;
      channelId?: string;
      limit?: string;
    };

    if (!accountId || !channelId) {
      return sendError(
        res,
        "accountId and channelId are required",
        "BAD_REQUEST",
        400
      );
    }

    const parsedLimit = limit ? Number(limit) : 50;
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 50;

    const messages = await discordService.getHistory(
      accountId,
      channelId,
      safeLimit
    );

    return sendOk(res, { messages });
  } catch (err: any) {
    logger.error("[discordGetHistory] failed", { err });
    return sendError(res, err.message ?? "Failed to load Discord history");
  }
}

// POST /discord/sendMessage
export async function discordSendMessage(req: Request, res: Response) {
  try {
    const { accountId, channelId, text } = req.body;

    if (!accountId || !channelId || !text || typeof text !== "string") {
      return sendError(
        res,
        "accountId, channelId and text are required",
        "BAD_REQUEST",
        400
      );
    }

    const message = await discordService.sendMessage(
      accountId,
      channelId,
      text
    );

    return sendOk(res, { message });
  } catch (err: any) {
    logger.error("[discordSendMessage] failed", { err });
    return sendError(res, err.message ?? "Failed to send Discord message");
  }
}

// POST /discord/sendFile
export async function discordSendFile(req: Request, res: Response) {
  try {
    const { accountId, channelId, caption } = req.body;
    const file = req.file;

    if (!accountId || !channelId) {
      return sendError(
        res,
        "accountId and channelId are required",
        "BAD_REQUEST",
        400
      );
    }

    if (!file || !file.buffer || !file.originalname) {
      return sendError(
        res,
        "file is required (multipart/form-data)",
        "BAD_REQUEST",
        400
      );
    }

    const message = await discordService.sendFile(
      accountId,
      channelId,
      file.buffer,
      file.originalname,
      caption
    );

    return sendOk(res, { message });
  } catch (err: any) {
    logger.error("[discordSendFile] failed", { err });
    return sendError(res, err.message ?? "Failed to send Discord file");
  }
}
