/**
 * backend/controllers/authController.ts
 * Handles user authentication (registration & login) with unified API structure and structured logging.
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import {
  isValidEmail,
  isValidName,
  isValidPassword,
} from "../utils/validation";
import { logger } from "../utils/logger";
import telegramClientManager from "../services/telegram/telegramClientManager";

/**
 * Standard shape for error responses
 */
interface ApiErrorResponse {
  status: "error";
  code:
    | "VALIDATION_ERROR"
    | "USER_EXISTS"
    | "USER_NOT_FOUND"
    | "BAD_CREDENTIALS"
    | "UNEXPECTED";
  message: string;
  details?: string[];
}

/**
 * Standard success response for authentication
 */
interface AuthSuccessResponse {
  status: "ok";
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      displayName?: string | null;
    };
  };
}

/** Helper to extract metadata for logging */
function extractRequestMeta(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "unknown",
  };
}

/** Helper to send a validation error */
function respondValidationError(
  req: Request,
  res: Response,
  message = "Validation error",
  details?: string[]
) {
  logger.warn("Validation error", { ...extractRequestMeta(req), details });
  return res.status(400).json({
    status: "error",
    code: "VALIDATION_ERROR",
    message,
    ...(details ? { details } : {}),
  });
}

/** Helper for unexpected errors */
function respondUnexpected(req: Request, res: Response, err?: unknown) {
  logger.error("Unexpected error", {
    ...extractRequestMeta(req),
    error: String(err),
  });
  return res.status(500).json({
    status: "error",
    code: "UNEXPECTED",
    message: "Internal server error",
  });
}

/**
 * Register new user
 */
export async function registerUser(
  req: Request,
  res: Response
): Promise<Response<AuthSuccessResponse | ApiErrorResponse>> {
  try {
    const { email, password, name } = req.body ?? {};
    const meta = extractRequestMeta(req);

    if (!email || !password) {
      return respondValidationError(
        req,
        res,
        "Email and password are required."
      );
    }
    if (!isValidEmail(email)) {
      return respondValidationError(req, res, "Invalid email format.");
    }

    const pwdCheck = isValidPassword(password);
    if (!pwdCheck.isValid) {
      const details: string[] = [];
      if (!pwdCheck.hasMinLength)
        details.push("Password must be at least 8 characters.");
      if (!pwdCheck.hasLetter)
        details.push("Password must contain at least one letter.");
      if (!pwdCheck.hasDigit)
        details.push("Password must contain at least one digit.");
      return respondValidationError(
        req,
        res,
        "Password does not meet policy.",
        details
      );
    }

    if (name && !isValidName(name)) {
      return respondValidationError(req, res, "Invalid display name.");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      logger.warn("Register failed: user already exists", { ...meta, email });
      return res.status(400).json({
        status: "error",
        code: "USER_EXISTS",
        message: "User with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: name ?? null,
      },
      select: { id: true, email: true, displayName: true },
    });

    const token = generateToken(created.id);
    logger.info("User registered successfully", {
      ...meta,
      userId: created.id,
    });

    return res.status(201).json({
      status: "ok",
      data: {
        token,
        user: {
          id: created.id,
          email: created.email,
          displayName: created.displayName,
        },
      },
    });
  } catch (err) {
    return respondUnexpected(req, res, err);
  }
}

/**
 * Login existing user
 */
export async function loginUser(
  req: Request,
  res: Response
): Promise<Response<AuthSuccessResponse | ApiErrorResponse>> {
  try {
    const { email, password } = req.body ?? {};
    const meta = extractRequestMeta(req);

    if (!email || !password) {
      return respondValidationError(
        req,
        res,
        "Email and password are required."
      );
    }
    if (!isValidEmail(email)) {
      return respondValidationError(req, res, "Invalid email format.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, displayName: true },
    });

    if (!user) {
      logger.warn("Login failed: user not found", { ...meta, email });
      return res.status(404).json({
        status: "error",
        code: "USER_NOT_FOUND",
        message: "User not found.",
      });
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      logger.warn("Login failed: bad credentials", {
        ...meta,
        userId: user.id,
      });
      return res.status(401).json({
        status: "error",
        code: "BAD_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(user.id);
    logger.info("User logged in successfully", { ...meta, userId: user.id });
    try {
      await telegramClientManager.attachAllForUser(user.id);
      logger.info("Telegram clients initialized", { userId: user.id });
    } catch (err) {
      logger.error("Failed to initialize Telegram clients", {
        userId: user.id,
        error: String(err),
      });
    }
    return res.status(200).json({
      status: "ok",
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      },
    });
  } catch (err) {
    return respondUnexpected(req, res, err);
  }
}

export async function logoutUser(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const userId = req.userId;
    const meta = extractRequestMeta(req);

    if (!userId) {
      logger.warn("[authController] Logout failed: unauthorized", { ...meta });
      return res.status(401).json({
        status: "error",
        code: "UNAUTHORIZED",
        message: "Unauthorized request.",
      });
    }

    // Here you can handle token invalidation if you store tokens server-side

    try {
      await telegramClientManager.detachAllForUser(userId);
    } catch (err) {
      logger.error(
        "[authController] Failed to detach Telegram clients on logout",
        {
          userId,
          error: String(err),
        }
      );
    }
    logger.info("[authController] User logged out successfully", {
      ...meta,
      userId,
    });
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    return respondUnexpected(req, res, err);
  }
}
