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

    const result = await telegramService.sendCode(String(phoneNumber).trim());
    return res.status(200).json({
      status: result.status,
      message: result.phone_code_hash,
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
    const { phoneNumber, phoneCode, phoneCodeHash } = req.body;
    const userId = req.userId;

    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        status: "error",
        code: "BAD_PHONE_NUMBER",
        message: "[telegramController] Phone number is not valid",
      });
    }

    const response = await telegramService.signIn({
      phoneNumber,
      phoneCode,
      phoneCodeHash,
    });

    if (response.status === "need_password") {
      return res.status(200).json({ status: "need_password" });
    }

    if (response.status === "ok") {
      const result = await telegramService.saveSession(
        userId!,
        response.sessionString!,
        response.user as Api.User
      );

      return res.status(200).json({
        status: "ok",
        accountId: result.accountId,
        username: response.user?.username,
      });
    }

    throw new Error("TELEGRAM_SERVICE_ERROR");
  } catch (err) {
    return res.status(500).json({
      status: "error",
      code: "UNEXPECTED",
      message: "[telegramController] Unexpected error occurred.",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Implementation for logging out
};

export const verifyTwoFA = async (req: Request, res: Response) => {
  // Implementation for verifying 2FA
};
