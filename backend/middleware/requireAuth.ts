/**
 * backend/middleware/requireAuth.ts
 * Ensures that the request contains a valid JWT token and extracts userId.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../utils/jwt";

/**
 * Shape of decoded JWT payload as expected in our app.
 */
interface DecodedToken {
  user_id: string; // encoded user ID in the token
}

/**
 * Unified error response for unauthorized access.
 */
function unauthorized(
  res: Response,
  code: "UNAUTHORIZED" | "TOKEN_EXPIRED" | "INVALID_TOKEN",
  message: string
) {
  return res.status(401).json({
    status: "error",
    code,
    message,
  });
}

/**
 * Middleware that verifies JWT from "Authorization: Bearer <token>"
 * and attaches `userId` to req for downstream usage.
 *
 * Expected behavior:
 * - On success: calls next()
 * - On error: returns standardized JSON with status:"error"
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return unauthorized(
        res,
        "UNAUTHORIZED",
        "Authorization header is missing."
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      return unauthorized(
        res,
        "INVALID_TOKEN",
        "Invalid authorization format."
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return unauthorized(res, "INVALID_TOKEN", "Token is empty or invalid.");
    }

    const decoded = verifyToken(token) as DecodedToken;
    if (!decoded || !decoded.user_id) {
      return unauthorized(res, "INVALID_TOKEN", "Token payload is invalid.");
    }

    // Attach user ID to request for further use
    req.userId = decoded.user_id;

    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return unauthorized(res, "TOKEN_EXPIRED", "Token has expired.");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return unauthorized(res, "INVALID_TOKEN", "Token validation failed.");
    }

    return unauthorized(
      res,
      "UNAUTHORIZED",
      "Authentication failed due to unexpected error."
    );
  }
}
