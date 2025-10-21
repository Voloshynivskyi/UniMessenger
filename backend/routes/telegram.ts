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
} from "../controllers/telegramController";
const router = Router();
router.post("/sendCode", sendCode);
router.post("/signIn", signIn);
router.post("/2fa", verifyTwoFA);
router.post("/logout", logout);

export default router;
