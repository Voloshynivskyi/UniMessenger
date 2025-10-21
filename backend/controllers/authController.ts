/**
 * backend/controllers/authController.ts
 * Handles user authentication operations including registration and login
 */
import { prisma } from "../lib/prisma";
import type { Request, Response } from "express";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import {
  isValidPassword,
  isValidName,
  isValidEmail,
} from "../utils/validation";

export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "[Auth controller] User already exists" });
    }
    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.isValid) {
      const errors = [];
      if (!passwordCheck.hasMinLength)
        errors.push("Password must be at least 8 characters");
      if (!passwordCheck.hasLetter)
        errors.push("Password must contain at least one letter");
      if (!passwordCheck.hasNumber)
        errors.push("Password must contain at least one number");
      if (!passwordCheck.hasSpecial)
        errors.push("Password must contain at least one special character");
      return res
        .status(400)
        .json({ error: "[Auth controller] Invalid password:", errors });
    }

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ error: "[Auth controller] Invalid email:" });
    }
    if (name && !isValidName(name)) {
      return res.status(400).json({
        error:
          "[Auth controller] Invalid name format(special signs are not allowed)",
      });
    }
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        displayName: name || null,
      },
    });
    const token = generateToken(newUser.id);
    return res
      .status(201)
      .json({ token, user: { id: newUser.id, email: newUser.email } });
  } catch (err) {
    console.log("[Auth controller] Register error: ", err);
    return res.status(500).json({ error: "[Auth controller] Server error" });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      return res
        .status(404)
        .json({ error: "[Auth controller] User not found" });
    }
    const isValid = await comparePassword(password, existingUser.passwordHash);
    if (!isValid) {
      return res
        .status(401)
        .json({ error: "[Auth controller] Password is not valid" });
    }
    const token = generateToken(existingUser.id);
    return res.status(200).json({
      token,
      user: { id: existingUser.id, email: existingUser.email },
    });
  } catch (err) {
    console.log("[Auth controller] Login error: ", err);
    return res.status(500).json({ error: "[Auth controller] Server error" });
  }
}
