/**
 * backend/controllers/userController.ts
 * Handles user profile operations including getting current user information
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.userId)
      return res.status(401).json({ message: "[getMe] Unauthorized request" });

    const user_id = req.userId;
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    if (!user)
      return res.status(404).json({ message: "[getMe] User is not found" });

    return res.status(200).json({ user });
  } catch {
    return res.status(500).json({ message: "[getMe] Server error" });
  }
}
