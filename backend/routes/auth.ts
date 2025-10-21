/**
 * backend/routes/auth.ts
 * Authentication routes for user registration and login endpoints
 */

import { Router } from "express";
import { registerUser, loginUser } from "../controllers/authController";

const router = Router();
router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
