/**
 * backend/routes/me.ts
 * Routes for authenticated user profile retrieval
 */

import { Router } from "express";
import { getMe } from "../controllers/userController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * @route GET /me
 * @desc Get currently authenticated user info
 * @access Private
 */
router.get("/", requireAuth, getMe);

export default router;
