/**
 * backend/routes/telegram.ts
 * Routes for Telegram MTProto authentication and account management
 */

import { Router } from "express";
import {
  sendCode,
  signIn,
  logout,
  verifyTwoFA,
  getTelegramAccounts,
  getDialogs,
  getMessageHistory,
} from "../controllers/telegramController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * @route POST /telegram/sendCode
 * @desc Send Telegram authentication code via MTProto
 * @access Private
 */
router.post("/sendCode", requireAuth, sendCode);

/**
 * @route POST /telegram/signIn
 * @desc Complete MTProto sign-in (code-based)
 * @access Private
 */
router.post("/signIn", requireAuth, signIn);

/**
 * @route POST /telegram/2fa
 * @desc Complete MTProto 2FA password step
 * @access Private
 */
router.post("/2fa", requireAuth, verifyTwoFA);

/**
 * @route POST /telegram/logout
 * @desc Logout Telegram account (invalidate session)
 * @access Private
 */
router.post("/logout", requireAuth, logout);

/**
 * @route GET /telegram/accounts
 * @desc Get all Telegram accounts attached to current user
 * @access Private
 */
router.get("/accounts", requireAuth, getTelegramAccounts);

/**
 * @route GET /telegram/dialogs
 * @desc Get dialogs for a specific Telegram account
 * @access Private
 */
router.get("/dialogs", requireAuth, getDialogs);

/**
 * @route GET /telegram/history
 * @desc Get message history for a specific Telegram account
 * @access Private
 */
router.get("/history", requireAuth, getMessageHistory);
export default router;
