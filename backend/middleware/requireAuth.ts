// backend/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { verifyToken } from "../utils/jwt";
dotenv.config();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    console.log(
      "[requireAuth] Authentication attempt for:",
      req.method,
      req.path
    );
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      console.log("[requireAuth] Failed: No authorization header provided");
      return res
        .status(401)
        .json({ error: "[requireAuth] Unauthorized request" });
    }
    if (!authHeader.startsWith("Bearer ")) {
      console.log(
        "[requireAuth] Failed: Invalid authorization format, header:",
        authHeader
      );
      return res
        .status(401)
        .json({ error: "[requireAuth] Invalid authorization format" });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token.trim()) {
      console.log("[requireAuth] Failed: Empty token provided");
      return res.status(401).json({ error: "[requireAuth] Empty token" });
    }
    const decoded = verifyToken(token);
    if (!decoded.user_id) {
      console.log(
        "[requireAuth] Failed: Invalid token payload, decoded:",
        decoded
      );
      return res
        .status(401)
        .json({ error: "[requireAuth] Invalid token payload" });
    }
    req.userId = decoded.user_id;
    console.log(
      "[requireAuth] Success: User authenticated with ID:",
      decoded.user_id
    );

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "[requireAuth] Token expired" });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "[requireAuth] Invalid token" });
    }
    return res
      .status(500)
      .json({ error: "[requireAuth] Authentication failed" });
  }
}
