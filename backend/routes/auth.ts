/**
 * backend/routes/auth.ts
 * Routes for user authentication (registration and login)
 */

import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/authController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post("/register", registerUser);

/**
 * @route POST /auth/login
 * @desc Authenticate user and return JWT token
 * @access Public
 */
router.post("/login", loginUser);

/**
 * @route POST /auth/logout
 * @desc Logout user
 * @access Private
 */
router.post("/logout", requireAuth, logoutUser);

export default router;
