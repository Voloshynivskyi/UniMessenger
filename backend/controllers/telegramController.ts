/**
 * backend/controllers/telegramController.ts
 * Telegram MTProto auth flow: sendCode, signIn, 2FA, get accounts, logout.
 * Unified API contract with backward-compatible payload.
 */

import type { Request, Response } from "express";
import type { Api } from "telegram";
import { TelegramService } from "../services/telegram/telegramService";
import { prisma } from "../lib/prisma";
import { isValidPhone } from "../utils/validation";
import { logger } from "../utils/logger";
import { getSocketGateway } from "../realtime/socketGateway";
import { parseTelegramMessage } from "../utils/telegram/parseTelegramMessage";
import telegramClientManager from "../services/telegram/telegramClientManager";

const telegramService = new TelegramService();

/**
 * Standard error response shape for controller endpoints.
 */
interface ApiErrorResponse {
  status: "error";
  code:
    | "BAD_PHONE_NUMBER"
    | "PHONE_NUMBER_INVALID"
    | "FLOOD_WAIT"
    | "BAD_CODE"
    | "MISSING_FIELDS"
    | "UNEXPECTED"
    | "BAD_REQUEST";
  message: string;
  retryAfter?: number | null; // used for FLOOD_WAIT (seconds)
}

/**
 * Account info payload shared across endpoints.
 * `connected` is kept for backward-compatibility (deprecated).
 */
interface AccountInfo {
  accountId: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  /** @deprecated use isActive instead */
  connected: boolean;
}

/**
 * Unified success response wrapper.
 * `data` is endpoint-specific.
 */
interface ApiSuccessResponse<T = unknown> {
  status: "ok";
  data: T;
}

/**
 * Helper: send a uniform error response.
 */
export function sendError(
  res: Response,
  code: ApiErrorResponse["code"],
  message: string,
  http = 400,
  extras?: Partial<Pick<ApiErrorResponse, "retryAfter">>
) {
  const body: ApiErrorResponse = {
    status: "error",
    code,
    message,
    ...(extras ?? {}),
  };
  return res.status(http).json(body);
}

/**
 * Helper: send a uniform success response.
 */
export function sendOk<T>(res: Response, data: T, http = 200) {
  const body: ApiSuccessResponse<T> = { status: "ok", data };
  return res.status(http).json(body);
}

/**
 * Sends a Telegram verification code to the provided phone number.
 *
 * Request body:
 *  - phoneNumber: string (E.164 format)
 *
 * Success: 200
 *  {
 *    "status": "ok",
 *    "data": {
 *      "phoneCodeHash": "...",
 *      "tempSession": "...",
 *      "legacyStatus": "code_sent"  // kept for backward-compatibility
 *    }
 *  }
 *
 * Errors:
 *  - 400 BAD_PHONE_NUMBER
 *  - 400 PHONE_NUMBER_INVALID (from Telegram)
 *  - 429 FLOOD_WAIT (with retryAfter seconds)
 *  - 500 UNEXPECTED
 */
export async function sendCode(req: Request, res: Response) {
  try {
    const { phoneNumber } = req.body ?? {};
    if (!isValidPhone(phoneNumber)) {
      return sendError(
        res,
        "BAD_PHONE_NUMBER",
        "[telegramController] Phone number is not valid",
        400
      );
    }

    const response = await telegramService.sendCode(String(phoneNumber).trim());
    // Original service returns: { status: "code_sent", phoneCodeHash, tempSession }
    return sendOk(res, {
      phoneCodeHash: response.phoneCodeHash,
      tempSession: response.tempSession,
      legacyStatus: response.status, // "code_sent"
    });
  } catch (err: any) {
    const msg = String(err?.message || err);

    if (msg.includes("FLOOD_WAIT")) {
      const seconds = Number(msg.split("_").pop());
      return sendError(
        res,
        "FLOOD_WAIT",
        "[telegramController] Telegram limited requests, due to floodwait.",
        429,
        { retryAfter: Number.isFinite(seconds) ? seconds : null }
      );
    }

    if (msg.includes("PHONE_NUMBER_INVALID")) {
      return sendError(
        res,
        "PHONE_NUMBER_INVALID",
        "[telegramController] Telegram dismissed the phone number.",
        400
      );
    }

    return sendError(
      res,
      "UNEXPECTED",
      "[telegramController] Unexpected error occurred.",
      500
    );
  }
}

/**
 * Completes sign-in with SMS code. If password is required, returns a flag
 * while preserving the original payload semantics.
 *
 * Request body:
 *  - phoneNumber: string
 *  - phoneCode: string
 *  - phoneCodeHash: string
 *  - tempSession: string
 *
 * Success (password not needed): 200
 *  {
 *    "status": "ok",
 *    "data": {
 *      "operationStatus": "account_created" | "session_replaced",
 *      "accountId": "...",
 *      "telegramId": "...",
 *      "username": "...",
 *      "phoneNumber": "...",
 *      "firstName": "...",
 *      "lastName": "...",
 *      "isActive": true,
 *      "connected": true     // deprecated mirror of isActive
 *    }
 *  }
 *
 * Success (password needed): 200
 *  {
 *    "status": "ok",
 *    "data": {
 *      "needsPassword": true,
 *      "tempSession": "...",
 *      "legacyStatus": "need_password"
 *    }
 *  }
 *
 * Errors: 500 UNEXPECTED
 */
export async function signIn(req: Request, res: Response) {
  try {
    const { phoneNumber, phoneCode, phoneCodeHash, tempSession } =
      req.body ?? {};
    const userId = req.userId;

    if (!isValidPhone(phoneNumber)) {
      return sendError(
        res,
        "BAD_PHONE_NUMBER",
        "[telegramController][signIn] Phone number is not valid",
        400
      );
    }

    const response = await telegramService.signIn({
      phoneNumber,
      phoneCode,
      phoneCodeHash,
      tempSession,
    });

    // Service yielded "need_password": return flag + tempSession
    if (response.status === "need_password") {
      return sendOk(res, {
        needsPassword: true,
        tempSession: response.tempSession,
        legacyStatus: "need_password",
      });
    }

    if (response.status === "ok") {
      const user = response.user as Api.User;

      const result = await telegramService.saveSession(
        userId!,
        response.sessionString!,
        user
      );

      // Mirror original payload while standardizing naming
      return sendOk(res, {
        operationStatus: result.status, // "account_created" | "session_replaced"
        accountId: result.accountId,
        telegramId: user.id.toString(),
        username: user.username ?? null,
        phoneNumber: user.phone ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        isActive: true,
        connected: true, // deprecated
      });
    }

    return sendError(
      res,
      "UNEXPECTED",
      "[telegramController][signIn] Unexpected service status",
      500
    );
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "[telegramController][signIn] Unexpected error occurred.",
      500
    );
  }
}

/**
 * Completes sign-in with 2FA password (SRP), creating/replacing session and
 * returning account identity payload.
 *
 * Request body:
 *  - tempSession: string
 *  - password: string
 *
 * Success: 200
 *  {
 *    "status": "ok",
 *    "data": {
 *      "operationStatus": "account_created" | "session_replaced",
 *      "accountId": "...",
 *      "telegramId": "...",
 *      "username": "...",
 *      "phoneNumber": "...",
 *      "firstName": "...",
 *      "lastName": "...",
 *      "isActive": true,
 *      "connected": true
 *    }
 *  }
 *
 * Errors:
 *  - 400 MISSING_FIELDS
 *  - 500 UNEXPECTED
 */
export async function verifyTwoFA(req: Request, res: Response) {
  try {
    const { tempSession, password } = req.body ?? {};
    const userId = req.userId;

    if (!tempSession || !password) {
      return sendError(
        res,
        "MISSING_FIELDS",
        "[telegramController][verifyTwoFA] Missing required fields",
        400
      );
    }

    const response = await telegramService.signInWithPassword({
      password,
      tempSession,
    });

    const user = response.user as Api.User;
    const result = await telegramService.saveSession(
      userId!,
      response.sessionString!,
      user
    );

    return sendOk(res, {
      operationStatus: result.status,
      accountId: result.accountId,
      telegramId: user.id.toString(),
      username: user.username ?? null,
      phoneNumber: user.phone ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      isActive: true,
      connected: true, // deprecated
    });
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "[telegramController][verifyTwoFA] Unexpected error",
      500
    );
  }
}

/**
 * Returns all Telegram accounts attached to the current user.
 *
 * Success: 200
 *  {
 *    "status": "ok",
 *    "data": {
 *      "accounts": AccountInfo[]
 *    }
 *  }
 *
 * Notes:
 *  - `isActive` comes from DB `TelegramAccount.isActive`
 *  - `connected` is kept (derived) for backward-compatibility
 */
export async function getTelegramAccounts(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const accounts = await prisma.telegramAccount.findMany({
      where: { userId },
      include: { session: true },
    });

    const payload: AccountInfo[] = accounts.map((acc) => {
      const isActive = Boolean(acc.isActive || acc.session !== null);
      return {
        accountId: acc.id,
        telegramId: acc.telegramId,
        username: acc.username,
        phoneNumber: acc.phoneNumber,
        firstName: acc.firstName,
        lastName: acc.lastName,
        isActive,
        connected: isActive, // deprecated alias
      };
    });

    return sendOk(res, { accounts: payload });
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "Failed to get accounts",
      500
    );
  }
}

/**
 * Logs out a Telegram account:
 * - Calls MTProto LogOut on the active session (best-effort)
 * - Deletes session from DB
 * - Marks account as inactive
 *
 * Request body:
 *  - accountId: string
 *
 * Success: 200 { "status": "ok", "data": {} }
 *
 * Errors: 500 UNEXPECTED
 */
export async function logout(req: Request, res: Response) {
  try {
    const { accountId } = req.body ?? {};
    await telegramService.logout(accountId);
    await prisma.telegramAccount.delete({
      where: { id: accountId },
    });
    return sendOk(res, {});
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "Failed to logout",
      500
    );
  }
}

/** * Retrieves dialogs for a given Telegram account.
 * Request body:
 * - accountId: string
 * - limit?: number
 * - offsetDate?: string (ISO timestamp)
 * - offsetId?: string
 * - offsetPeer?: { id: string; accessHash?: string; type: "user" | "chat" | "channel" }
 *
 * Success: 200
 * {
 *   "status": "ok",
 *   "data": {
 *     "dialogs": UnifiedTelegramChat[]
 *   }
 * }
 *
 * Errors: 500 UNEXPECTED
 */

export async function getDialogs(req: Request, res: Response) {
  try {
    const accountId = req.query.accountId as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const offsetDate = req.query.offsetDate
      ? Number(req.query.offsetDate)
      : undefined;
    const offsetId = req.query.offsetId
      ? Number(req.query.offsetId)
      : undefined;

    // peer.id, peer.type, peer.accessHash — all optional
    const offsetPeer = req.query.offsetPeerId
      ? {
          id: Number(req.query.offsetPeerId),
          type: req.query.offsetPeerType as "user" | "chat" | "channel",
          ...(req.query.offsetPeerAccessHash
            ? { accessHash: String(req.query.offsetPeerAccessHash) }
            : {}),
        }
      : undefined;

    if (!accountId) {
      return sendError(res, "BAD_REQUEST", "accountId is required", 400);
    }

    const response = await telegramService.getDialogs({
      accountId,
      limit,
      ...(offsetDate !== undefined ? { offsetDate } : {}),
      ...(offsetId !== undefined ? { offsetId } : {}),
      ...(offsetPeer ? { offsetPeer } : {}),
    });
    return sendOk(res, {
      dialogs: response.dialogs,
      nextOffset: response.nextOffset,
    });
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "Failed to get dialogs",
      500
    );
  }
}

export const getMessageHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // from requireAuth middleware

    const { accountId, peerType, peerId, accessHash, limit, offsetId } =
      req.query;

    // Validate required params
    if (!accountId || !peerType || !peerId || !userId) {
      return sendError(
        res,
        "BAD_REQUEST",
        "Missing required parameters: accountId, peerType, peerId",
        400
      );
    }

    if (peerType !== "user" && peerType !== "chat" && peerType !== "channel") {
      return sendError(
        res,
        "BAD_REQUEST",
        "Invalid peerType. Must be 'user', 'chat', or 'channel'.",
        400
      );
    }

    // Make sure account belongs to user
    const account = await prisma.telegramAccount.findFirst({
      where: { id: String(accountId), userId },
    });

    if (!account) {
      return sendError(
        res,
        "BAD_REQUEST",
        "Account does not belong to authenticated user",
        400
      );
    }

    // Fetch from service
    const serviceResponse = await telegramService.getChatHistory({
      accountId: String(accountId),
      peerType: peerType as "user" | "chat" | "channel",
      peerId: peerId as string,
      accessHash: accessHash ? String(accessHash) : null,
      limit: limit ? Number(limit) : 50,
      offsetId: offsetId ? Number(offsetId) : 0,
    });
    // Response structure
    return sendOk(res, {
      messages: serviceResponse.messages, // parsed & normalized messages
      raw: serviceResponse.rawMessages, // for debugging (optional)
      nextOffsetId: serviceResponse.nextOffsetId,
    });
  } catch (err) {
    logger.error("getMessageHistory error:", { err });

    return sendError(
      res,
      "UNEXPECTED",
      err instanceof Error ? err.message : "Failed to get message history",
      500
    );
  }
};
type MediaKind = "voice" | "video_note" | "file";

export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { accountId, peerType, peerId, accessHash, text, tempId } = req.body;
    const file = req.file;

    const textLength = typeof text === "string" ? text.length : 0;

    if (!textLength && !file) {
      return sendError(res, "BAD_REQUEST", "Message must have text or file");
    }

    // Get mediaKind from body (comes from frontend as string)
    const rawMediaKind = (req.body.mediaKind || "") as string;
    const mediaKind: MediaKind | undefined =
      rawMediaKind === "voice" ||
      rawMediaKind === "video_note" ||
      rawMediaKind === "file"
        ? (rawMediaKind as MediaKind)
        : undefined;

    let sent;

    if (file) {
      const payload: any = {
        accountId,
        peerType,
        peerId,
        accessHash,
        text: text || "",
        fileBuffer: file.buffer,
        fileName: file.originalname,
      };

      if (mediaKind !== undefined) {
        payload.mediaKind = mediaKind; // CRITICAL
      }

      sent = await telegramService.sendUnified(payload);
    } else {
      sent = await telegramService.sendUnified({
        accountId,
        peerType,
        peerId,
        accessHash,
        text: text || "",
      });
    }

    // -------------------------------
    //  PARSE RAW TELEGRAM MESSAGE
    // -------------------------------
    const unified = parseTelegramMessage(sent.raw, accountId);

    unified.chatId = String(peerId);
    unified.peerId = String(peerId);
    unified.accountId = accountId;
    unified.isOutgoing = true;
    unified.tempId = tempId ? String(tempId) : null;

    const gateway = getSocketGateway();

    gateway.emitToUser(userId, "telegram:message_confirmed", {
      platform: "telegram",
      accountId,
      chatId: String(peerId),
      tempId: tempId ? String(tempId) : null,
      message: unified,
      timestamp: new Date().toISOString(),
    });

    return sendOk(res, { ok: true });
  } catch (err: any) {
    logger.error("[telegramController.sendMessage] UNEXPECTED error", {
      message: err.message,
      name: err.name,
      stack: err.stack,
      telegramError: err.data?.errorMessage,
      data: err.data,
    });

    return sendError(res, "UNEXPECTED", err.message);
  }
}
