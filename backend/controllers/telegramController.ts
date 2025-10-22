/**
 * backend/controllers/telegramController.ts
 * Handles Telegram authentication operations including phone verification, sign-in, and account management
 */
import type { Request, Response } from "express";
import { TelegramService } from "../services/telegramService";
import { isValidPhone } from "../utils/validation";
import { prisma } from "../lib/prisma";
import type { Api } from "telegram";

const telegramService = new TelegramService();

export const sendCode = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body ?? {};
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        status: "error",
        code: "BAD_PHONE_NUMBER",
        message: "[telegramController] Phone number is not valid",
      });
    }

    const response = await telegramService.sendCode(String(phoneNumber).trim());
    return res.status(200).json({
      status: response.status,
      phoneCodeHash: response.phoneCodeHash,
      tempSession: response.tempSession,
    });
  } catch (err: any) {
    const msg = String(err?.message || err);

    if (msg.includes("FLOOD_WAIT")) {
      const seconds = Number(msg.split("_").pop());
      return res.status(429).json({
        status: "error",
        code: "FLOOD_WAIT",
        retry_after: Number.isFinite(seconds) ? seconds : undefined,
        message:
          "[telegramController] Telegram limited requests, due to floodwait.",
      });
    }

    if (msg.includes("PHONE_NUMBER_INVALID")) {
      return res.status(400).json({
        status: "error",
        code: "PHONE_NUMBER_INVALID",
        message: "[telegramController] Telegram dismissed the phone number.",
      });
    }

    return res.status(500).json({
      status: "error",
      code: "UNEXPECTED",
      message: "[telegramController] Unexpected error occurred.",
    });
  }
};

export const signIn = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, phoneCode, phoneCodeHash, tempSession } = req.body;
    const userId = req.userId;

    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        status: "error",
        code: "BAD_PHONE_NUMBER",
        message: "[telegramController][signIn] Phone number is not valid",
      });
    }

    const response = await telegramService.signIn({
      phoneNumber,
      phoneCode,
      phoneCodeHash,
      tempSession,
    });

    if (response.status === "need_password") {
      return res.status(200).json({
        status: "need_password",
        tempSession: response.tempSession,
      });
    }

    if (response.status === "ok") {
      const user = response.user as Api.User;

      const result = await telegramService.saveSession(
        userId!,
        response.sessionString!,
        user
      );

      return res.status(200).json({
        status: result.status,
        accountId: result.accountId,
        telegramId: user.id.toString(),
        username: user.username ?? null,
        phone: user.phone ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        connected: true,
      });
    }

    throw new Error("TELEGRAM_SERVICE_ERROR");
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      code: err.code || "UNEXPECTED",
      message:
        err.message ||
        "[telegramController][signIn] Unexpected error occurred.",
    });
  }
};

export const verifyTwoFA = async (req: Request, res: Response) => {
  try {
    const { tempSession, password } = req.body;
    const userId = req.userId;

    if (!tempSession || !password) {
      return res.status(400).json({
        status: "error",
        code: "MISSING_FIELDS",
        message: "[telegramController][verifyTwoFA] Missing required fields",
      });
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

    return res.status(200).json({
      status: result.status,
      accountId: result.accountId,
      telegramId: user.id.toString(),
      username: user.username ?? null,
      phone: user.phone ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      connected: true,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message:
        err.message || "[telegramController][verifyTwoFA] Unexpected error",
    });
  }
};

export const getTelegramAccounts = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const accounts = await prisma.telegramAccount.findMany({
      where: { userId: userId! },
      include: {
        session: true,
      },
    });

    const formatted = accounts.map((acc) => ({
      accountId: acc.id,
      telegramId: acc.telegramId,
      username: acc.username,
      phoneNumber: acc.phoneNumber,
      firstName: acc.firstName,
      lastName: acc.lastName,
      connected: acc.session !== null,
    }));

    return res.status(200).json({
      status: "ok",
      accounts: formatted,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Failed to get accounts",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;
    await telegramService.logout(accountId);
    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Failed to logout",
    });
  }
};
