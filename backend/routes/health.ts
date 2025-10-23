// backend/routes/health.ts
import { Router } from "express";
import { getHealth } from "../controllers/healthController";

const router = Router();

/**
 * @route GET /api/health
 * @desc Health check endpoint
 * @access Public
 */
router.get("/", getHealth);

export default router;
