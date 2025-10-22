/**
 * backend/routes/telegram.ts
 * Authentication routes for user registration and login endpoints
 */

import { Router } from "express";
import {
  sendCode,
  signIn,
  logout,
  verifyTwoFA,
  getTelegramAccounts,
} from "../controllers/telegramController";
import { requireAuth } from "../middleware/requireAuth";
const router = Router();
router.post("/sendCode", requireAuth, sendCode);
router.post("/signIn", requireAuth, signIn);
router.post("/2fa", requireAuth, verifyTwoFA);
router.post("/logout", requireAuth, logout);
router.post("/accounts", requireAuth, getTelegramAccounts);
export default router;
