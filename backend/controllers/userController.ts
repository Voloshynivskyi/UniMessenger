/**
 * backend/controllers/userController.ts
 * Handles user profile operations including retrieving current authenticated user's information.
 * Uses a unified API contract with structured responses.
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * Shape of the user data returned to the client.
 */
interface UserInfo {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}

/**
 * Standard successful API response containing user info.
 */
interface GetMeSuccessResponse {
  status: "ok";
  data: {
    user: UserInfo;
  };
}

/**
 * Standard error response shape.
 */
interface ApiErrorResponse {
  status: "error";
  code: "UNAUTHORIZED" | "USER_NOT_FOUND" | "UNEXPECTED";
  message: string;
}

/**
 * Sends a success response with unified structure.
 */
function sendOk(res: Response, data: GetMeSuccessResponse["data"]) {
  const body: GetMeSuccessResponse = {
    status: "ok",
    data,
  };
  return res.status(200).json(body);
}

/**
 * Sends an error response with unified structure.
 */
function sendError(
  res: Response,
  code: ApiErrorResponse["code"],
  message: string,
  httpStatus: number
) {
  const body: ApiErrorResponse = {
    status: "error",
    code,
    message,
  };
  return res.status(httpStatus).json(body);
}

/**
 * Retrieves the currently authenticated user.
 *
 * Requires a valid JWT middleware to have populated req.userId.
 *
 * Success Response (200):
 * {
 *   "status": "ok",
 *   "data": {
 *     "user": {
 *       "id": "...",
 *       "email": "...",
 *       "displayName": "...",
 *       "createdAt": "..."
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 401 UNAUTHORIZED   -> User is not authenticated
 * - 404 USER_NOT_FOUND -> Authenticated but no user record found
 * - 500 UNEXPECTED     -> Server error
 */
export async function getMe(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return sendError(
        res,
        "UNAUTHORIZED",
        "[getMe] Unauthorized request",
        401
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    if (!user) {
      return sendError(res, "USER_NOT_FOUND", "[getMe] User not found", 404);
    }

    return sendOk(res, { user });
  } catch (err: any) {
    return sendError(
      res,
      "UNEXPECTED",
      err?.message || "[getMe] Server error",
      500
    );
  }
}
