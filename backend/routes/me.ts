/**
 * backend/routes/me.ts
 * Authentication routes for checking if user is authorized
 */

import { Router } from "express";
import { getMe } from "../controllers/userController";
import { requireAuth } from "../middleware/requireAuth";
const router = Router();
router.get("/", requireAuth, getMe);

export default router;
